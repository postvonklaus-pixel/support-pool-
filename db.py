"""
Datenbank-Engine und Session-Handling.

Nutzt DATABASE_URL aus config.py (Fallback: lokale SQLite-Datei, damit das
Projekt ohne jedes externe Setup mit "python main.py" laeuft).
"""
import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import object_session, sessionmaker

from config import DATABASE_URL
from models import Base

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

if DATABASE_URL.startswith("sqlite:///"):
    sqlite_path = DATABASE_URL.replace("sqlite:///", "", 1)
    sqlite_dir = os.path.dirname(sqlite_path)
    if sqlite_dir:
        os.makedirs(sqlite_dir, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)
# Bewusst KEINE scoped_session: jeder SessionLocal()-Aufruf liefert eine neue,
# unabhaengige Session. Das haelt das Verhalten bei verschachtelten
# get_session()-Aufrufen (z.B. workflow.py haelt eine Session offen, waehrend
# ein Agent intern get_session_for() nutzt) vorhersagbar.
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    """Legt alle Tabellen an, falls sie noch nicht existieren."""
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_session():
    """Context-Manager fuer eine neue DB-Session mit automatischem Commit/Rollback."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_session_for(obj):
    """
    Wie get_session(), nutzt aber die Session, an die `obj` bereits gebunden
    ist (falls vorhanden), statt eine neue zu oeffnen.

    Wird von Agenten genutzt, die ein bereits geladenes ORM-Objekt (z.B.
    User) von einem Aufrufer (workflow.py, cli.py) uebergeben bekommen: ohne
    diese Wiederverwendung wuerde ein verschachtelter get_session()-Aufruf
    die vom Aufrufer noch benoetigte Session committen/schliessen und einen
    DetachedInstanceError beim naechsten Attribut-Zugriff verursachen.
    """
    existing = object_session(obj) if obj is not None else None
    if existing is not None:
        yield existing
        existing.flush()
        return

    with get_session() as session:
        yield session
