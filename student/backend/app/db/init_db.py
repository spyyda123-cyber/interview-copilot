from app.db.session import engine, init_db as init_vector_extension
from app.db.base import Base

# Import all models so SQLAlchemy registers them
import app.models.student
import app.models.resume
import app.models.knowledge
import app.models.plan


def init_db():
    print("Creating database tables...")
    init_vector_extension()
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


if __name__ == "__main__":
    init_db()
