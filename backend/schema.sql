-- PenPal+ database schema (reference DDL)
-- Auto-generated from the SQLAlchemy models in app/models.py.
-- The application creates these tables automatically on startup
-- (Base.metadata.create_all). This file is provided as a readable
-- reference and for bootstrapping a fresh database by hand if desired.
--
-- Dialect shown: SQLite (the zero-setup default). The same models also
-- run on PostgreSQL by setting DATABASE_URL=postgresql+psycopg2://...
-- (column types are mapped by SQLAlchemy per-dialect at runtime).

PRAGMA foreign_keys = ON;

CREATE TABLE achievements (
	id INTEGER NOT NULL, 
	code VARCHAR(40) NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	description VARCHAR(200) NOT NULL, 
	icon VARCHAR(8), 
	threshold INTEGER, 
	PRIMARY KEY (id)
);

CREATE TABLE communities (
	id INTEGER NOT NULL, 
	slug VARCHAR(60) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	description TEXT, 
	color VARCHAR(7), 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE plans (
	id INTEGER NOT NULL, 
	code VARCHAR(30) NOT NULL, 
	name VARCHAR(60) NOT NULL, 
	price_cents INTEGER, 
	currency VARCHAR(3), 
	interval VARCHAR(10), 
	features TEXT, 
	PRIMARY KEY (id)
);

CREATE TABLE stamps (
	id INTEGER NOT NULL, 
	code VARCHAR(40) NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	country VARCHAR(80), 
	country_code VARCHAR(2), 
	motif VARCHAR(8), 
	color VARCHAR(7), 
	rarity VARCHAR(10), 
	premium_only BOOLEAN, 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id INTEGER NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	is_admin BOOLEAN NOT NULL, 
	is_premium BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	last_active_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE audit_logs (
	id INTEGER NOT NULL, 
	user_id INTEGER, 
	action VARCHAR(60) NOT NULL, 
	detail VARCHAR(255), 
	ip VARCHAR(45), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE blocks (
	id INTEGER NOT NULL, 
	blocker_id INTEGER NOT NULL, 
	blocked_id INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_block UNIQUE (blocker_id, blocked_id), 
	FOREIGN KEY(blocker_id) REFERENCES users (id), 
	FOREIGN KEY(blocked_id) REFERENCES users (id)
);

CREATE TABLE community_members (
	id INTEGER NOT NULL, 
	community_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	role VARCHAR(10), 
	joined_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_community_member UNIQUE (community_id, user_id), 
	FOREIGN KEY(community_id) REFERENCES communities (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE drafts (
	id INTEGER NOT NULL, 
	author_id INTEGER NOT NULL, 
	recipient_id INTEGER, 
	subject VARCHAR(160), 
	body TEXT, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(author_id) REFERENCES users (id), 
	FOREIGN KEY(recipient_id) REFERENCES users (id)
);

CREATE TABLE friend_requests (
	id INTEGER NOT NULL, 
	requester_id INTEGER NOT NULL, 
	addressee_id INTEGER NOT NULL, 
	status VARCHAR(10) NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_friend_request UNIQUE (requester_id, addressee_id), 
	FOREIGN KEY(requester_id) REFERENCES users (id), 
	FOREIGN KEY(addressee_id) REFERENCES users (id)
);

CREATE TABLE friends (
	id INTEGER NOT NULL, 
	user_a_id INTEGER NOT NULL, 
	user_b_id INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_friend UNIQUE (user_a_id, user_b_id), 
	FOREIGN KEY(user_a_id) REFERENCES users (id), 
	FOREIGN KEY(user_b_id) REFERENCES users (id)
);

CREATE TABLE letters (
	id INTEGER NOT NULL, 
	sender_id INTEGER NOT NULL, 
	recipient_id INTEGER NOT NULL, 
	subject VARCHAR(160), 
	body TEXT NOT NULL, 
	stamp_id INTEGER, 
	state VARCHAR(12) NOT NULL, 
	distance_km FLOAT, 
	sent_at DATETIME NOT NULL, 
	deliver_at DATETIME NOT NULL, 
	delivered_at DATETIME, 
	read_at DATETIME, 
	reply_to_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sender_id) REFERENCES users (id), 
	FOREIGN KEY(recipient_id) REFERENCES users (id), 
	FOREIGN KEY(stamp_id) REFERENCES stamps (id), 
	FOREIGN KEY(reply_to_id) REFERENCES letters (id)
);

CREATE TABLE notifications (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	title VARCHAR(120) NOT NULL, 
	body VARCHAR(255), 
	link VARCHAR(120), 
	is_read BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE posts (
	id INTEGER NOT NULL, 
	community_id INTEGER NOT NULL, 
	author_id INTEGER NOT NULL, 
	title VARCHAR(160), 
	body TEXT NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(community_id) REFERENCES communities (id), 
	FOREIGN KEY(author_id) REFERENCES users (id)
);

CREATE TABLE profiles (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	display_name VARCHAR(80) NOT NULL, 
	handle VARCHAR(40) NOT NULL, 
	bio TEXT, 
	country VARCHAR(80), 
	country_code VARCHAR(2), 
	city VARCHAR(120), 
	latitude FLOAT, 
	longitude FLOAT, 
	timezone VARCHAR(60), 
	avatar_seed VARCHAR(40), 
	avatar_color VARCHAR(7), 
	gender VARCHAR(20), 
	birth_year INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE subscriptions (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	plan_id INTEGER NOT NULL, 
	status VARCHAR(10) NOT NULL, 
	started_at DATETIME, 
	current_period_end DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(plan_id) REFERENCES plans (id)
);

CREATE TABLE user_achievements (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	achievement_id INTEGER NOT NULL, 
	unlocked_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(achievement_id) REFERENCES achievements (id)
);

CREATE TABLE user_languages (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	code VARCHAR(8) NOT NULL, 
	name VARCHAR(40) NOT NULL, 
	fluency VARCHAR(10), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_language UNIQUE (user_id, code), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE user_sessions (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	refresh_token VARCHAR(512) NOT NULL, 
	device VARCHAR(120), 
	created_at DATETIME, 
	revoked BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE user_settings (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	auto_translate BOOLEAN, 
	discoverable BOOLEAN, 
	notify_on_delivery BOOLEAN, 
	distance_pref VARCHAR(10), 
	locale VARCHAR(10), 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE user_stamps (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	stamp_id INTEGER NOT NULL, 
	quantity INTEGER, 
	acquired_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_stamp UNIQUE (user_id, stamp_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(stamp_id) REFERENCES stamps (id)
);

CREATE TABLE user_topics (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	slug VARCHAR(40) NOT NULL, 
	label VARCHAR(60) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_topic UNIQUE (user_id, slug), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE comments (
	id INTEGER NOT NULL, 
	post_id INTEGER NOT NULL, 
	author_id INTEGER NOT NULL, 
	body TEXT NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES posts (id), 
	FOREIGN KEY(author_id) REFERENCES users (id)
);

CREATE TABLE invoices (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	subscription_id INTEGER, 
	number VARCHAR(40) NOT NULL, 
	amount_cents INTEGER, 
	currency VARCHAR(3), 
	status VARCHAR(8), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(subscription_id) REFERENCES subscriptions (id), 
	UNIQUE (number)
);

CREATE TABLE reports (
	id INTEGER NOT NULL, 
	reporter_id INTEGER NOT NULL, 
	reported_user_id INTEGER, 
	letter_id INTEGER, 
	reason VARCHAR(60) NOT NULL, 
	detail TEXT, 
	status VARCHAR(12) NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reporter_id) REFERENCES users (id), 
	FOREIGN KEY(reported_user_id) REFERENCES users (id), 
	FOREIGN KEY(letter_id) REFERENCES letters (id)
);

CREATE TABLE saved_letters (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	letter_id INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_saved_letter UNIQUE (user_id, letter_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(letter_id) REFERENCES letters (id)
);

CREATE TABLE transactions (
	id INTEGER NOT NULL, 
	invoice_id INTEGER NOT NULL, 
	provider_ref VARCHAR(60), 
	amount_cents INTEGER, 
	status VARCHAR(10), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoices (id)
);
