"""Community endpoints (PRD Part 4: /communities, /posts, /comments)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services

router = APIRouter(tags=["communities"])


def _community_out(db: Session, c: models.Community, user_id: int) -> schemas.CommunityOut:
    count = db.query(func.count(models.CommunityMember.id)).filter_by(community_id=c.id).scalar()
    joined = (
        db.query(models.CommunityMember)
        .filter_by(community_id=c.id, user_id=user_id)
        .first()
        is not None
    )
    return schemas.CommunityOut(
        id=c.id, slug=c.slug, name=c.name, description=c.description,
        color=c.color, member_count=count or 0, joined=joined,
    )


@router.get("/communities", response_model=list[schemas.CommunityOut])
def list_communities(db: Session = Depends(get_db),
                     user: models.User = Depends(get_current_user)):
    return [
        _community_out(db, c, user.id)
        for c in db.query(models.Community).order_by(models.Community.name).all()
    ]


@router.post("/communities/{community_id}/join", response_model=schemas.CommunityOut)
def join(community_id: int, db: Session = Depends(get_db),
         user: models.User = Depends(get_current_user)):
    c = db.get(models.Community, community_id)
    if not c:
        raise HTTPException(status_code=404, detail="Community not found")
    member = (
        db.query(models.CommunityMember)
        .filter_by(community_id=community_id, user_id=user.id)
        .first()
    )
    if member:
        db.delete(member)        # toggle: leave
    else:
        db.add(models.CommunityMember(community_id=community_id, user_id=user.id))
    db.commit()
    return _community_out(db, c, user.id)


@router.get("/communities/{community_id}/posts", response_model=list[schemas.PostOut])
def list_posts(community_id: int, db: Session = Depends(get_db),
               user: models.User = Depends(get_current_user)):
    posts = (
        db.query(models.Post)
        .filter_by(community_id=community_id)
        .order_by(models.Post.created_at.desc())
        .all()
    )
    out = []
    for p in posts:
        cc = db.query(func.count(models.Comment.id)).filter_by(post_id=p.id).scalar()
        out.append(schemas.PostOut(
            id=p.id, title=p.title, body=p.body, created_at=p.created_at,
            author=services.party_brief(p.author), comment_count=cc or 0,
        ))
    return out


@router.post("/communities/{community_id}/posts", response_model=schemas.PostOut, status_code=201)
def create_post(community_id: int, payload: schemas.PostCreate,
                db: Session = Depends(get_db),
                user: models.User = Depends(get_current_user)):
    c = db.get(models.Community, community_id)
    if not c:
        raise HTTPException(status_code=404, detail="Community not found")
    post = models.Post(
        community_id=community_id, author_id=user.id,
        title=payload.title, body=payload.body,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return schemas.PostOut(
        id=post.id, title=post.title, body=post.body, created_at=post.created_at,
        author=services.party_brief(user), comment_count=0,
    )


@router.get("/posts/{post_id}/comments", response_model=list[schemas.CommentOut])
def list_comments(post_id: int, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    comments = (
        db.query(models.Comment)
        .filter_by(post_id=post_id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )
    return [
        schemas.CommentOut(
            id=c.id, body=c.body, created_at=c.created_at,
            author=services.party_brief(c.author))
        for c in comments
    ]


@router.post("/posts/{post_id}/comments", response_model=schemas.CommentOut, status_code=201)
def create_comment(post_id: int, payload: schemas.CommentCreate,
                   db: Session = Depends(get_db),
                   user: models.User = Depends(get_current_user)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = models.Comment(post_id=post_id, author_id=user.id, body=payload.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return schemas.CommentOut(
        id=comment.id, body=comment.body, created_at=comment.created_at,
        author=services.party_brief(user))
