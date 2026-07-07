"""Subscription endpoints (PRD Part 4: /plans, /subscriptions).

Payment is mocked: any non-empty `payment_token` succeeds and produces an
invoice + transaction record, so the whole billing data model is exercised
without wiring a real gateway.
"""
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services

router = APIRouter(tags=["subscriptions"])


def _plan_out(plan: models.Plan) -> schemas.PlanOut:
    features = [f for f in (plan.features or "").split("\n") if f.strip()]
    return schemas.PlanOut(
        id=plan.id, code=plan.code, name=plan.name, price_cents=plan.price_cents,
        currency=plan.currency, interval=plan.interval, features=features,
    )


@router.get("/plans", response_model=list[schemas.PlanOut])
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(models.Plan).order_by(models.Plan.price_cents).all()
    return [_plan_out(p) for p in plans]


@router.get("/subscriptions/me", response_model=schemas.SubscriptionOut | None)
def my_subscription(db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    sub = (
        db.query(models.Subscription)
        .filter_by(user_id=user.id, status="active")
        .order_by(models.Subscription.started_at.desc())
        .first()
    )
    if not sub:
        return None
    return schemas.SubscriptionOut(
        status=sub.status, plan=_plan_out(sub.plan),
        started_at=sub.started_at, current_period_end=sub.current_period_end,
    )


@router.post("/subscriptions", response_model=schemas.SubscriptionOut, status_code=201)
def subscribe(payload: schemas.SubscribeIn, db: Session = Depends(get_db),
              user: models.User = Depends(get_current_user)):
    plan = db.get(models.Plan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not payload.payment_token:
        raise HTTPException(status_code=402, detail="Payment failed")

    now = services.utcnow()
    period = None
    if plan.interval == "month":
        period = now + timedelta(days=30)
    elif plan.interval == "year":
        period = now + timedelta(days=365)

    # Cancel any current active subscription before starting the new one.
    for old in db.query(models.Subscription).filter_by(user_id=user.id, status="active"):
        old.status = "cancelled"

    sub = models.Subscription(
        user_id=user.id, plan_id=plan.id, status="active",
        started_at=now, current_period_end=period,
    )
    db.add(sub)
    db.flush()

    if plan.price_cents > 0:
        invoice = models.Invoice(
            user_id=user.id, subscription_id=sub.id,
            number=f"INV-{now:%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
            amount_cents=plan.price_cents, currency=plan.currency, status="paid",
        )
        db.add(invoice)
        db.flush()
        db.add(models.Transaction(
            invoice_id=invoice.id,
            provider_ref=f"ch_{uuid.uuid4().hex[:18]}",
            amount_cents=plan.price_cents, status="succeeded",
        ))

    # Free plan turns premium off; paid plans turn it on.
    user.is_premium = plan.price_cents > 0
    services.notify(db, user.id, "system",
                    "Welcome to " + plan.name if user.is_premium else "Plan updated",
                    "Your subscription is active.")
    db.commit()
    db.refresh(sub)
    return schemas.SubscriptionOut(
        status=sub.status, plan=_plan_out(sub.plan),
        started_at=sub.started_at, current_period_end=sub.current_period_end,
    )


@router.post("/subscriptions/cancel", status_code=200)
def cancel(db: Session = Depends(get_db),
           user: models.User = Depends(get_current_user)):
    sub = (
        db.query(models.Subscription)
        .filter_by(user_id=user.id, status="active")
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")
    sub.status = "cancelled"
    user.is_premium = False
    db.commit()
    return {"detail": "Subscription cancelled. You keep access until the period ends."}
