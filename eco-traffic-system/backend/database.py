from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

# Connect to local Postgres
DATABASE_URL = "sqlite:///eco.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Trip(Base):
    __tablename__ = "trips"
    # Fields match the 'Off-chain Trip DB' requirements [cite: 295, 296, 297]
    trip_id = Column(String, primary_key=True)
    user_wallet = Column(String)
    selected_route_type = Column(String) # 'fastest' or 'eco'
    co2_saved = Column(Float)
    is_verified = Column(Boolean, default=False)
    verification_log = Column(JSON) # Stores GPS/FASTag logs [cite: 333]
    tx_hash = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)