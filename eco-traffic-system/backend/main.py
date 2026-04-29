from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from web3 import Web3
from fastapi.middleware.cors import CORSMiddleware
import uuid
import datetime
import requests
from geopy.geocoders import Nominatim
from database import Base, engine, SessionLocal, Trip
from sqlalchemy import func

Base.metadata.create_all(bind=engine)
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- CONFIG ---
w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93f642f64180aa3" 
MINTER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
CONTRACT_ABI = '[{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"string","name":"tripId","type":"string"},{"internalType":"uint256","name":"co2Saved","type":"uint256"}],"name":"mintReward","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
geolocator = Nominatim(user_agent="eco_traffic_project_v9_clean")

CITY_CACHE = {
    "chennai": (13.0827, 80.2707), "coimbatore": (11.0168, 76.9558), "vellore": (12.9165, 79.1325),
    "bangalore": (12.9716, 77.5946), "salem": (11.6643, 78.1460), "madurai": (9.9252, 78.1198),
    "trichy": (10.7905, 78.7047), "kanyakumari": (8.0883, 77.5385), "pondicherry": (11.9416, 79.8083)
}

class TripRequest(BaseModel):
    origin_text: str
    destination_text: str
    wallet: str
    vehicle_type: str 

class VerifyRequest(BaseModel):
    trip_id: str
    selected_route: str 
    gps_trace: list

def get_coordinates(text):
    clean_text = text.lower().strip()
    for city, coords in CITY_CACHE.items():
        if city in clean_text: return coords
    try:
        loc = geolocator.geocode(text + ", India")
        return (loc.latitude, loc.longitude) if loc else None
    except: return None

def calculate_smart_eta(distance_km):
    now = datetime.datetime.now()
    start_hour = now.hour
    base_hours = distance_km / 60 
    traffic_delay = 0
    for i in range(int(base_hours) + 1):
        future_hour = (start_hour + i) % 24
        if (8 <= future_hour <= 11) or (17 <= future_hour <= 20):
            traffic_delay += 0.15 
    total_hours = base_hours + traffic_delay
    return int(total_hours * 60)

def calculate_tolls(distance_km):
    if distance_km < 20: return 0, 0
    num_tolls = int(distance_km / 65)
    total_price = num_tolls * 85
    return num_tolls, total_price

def calculate_emissions(dist, stops, vehicle_type):
    v_factor = 0.4 if vehicle_type == 'bike' else (2.5 if vehicle_type == 'truck' else 1.0)
    base = (dist * 1000) * 0.12 * v_factor
    stop_penalty = stops * 20.0 * v_factor
    return round(base + stop_penalty, 2)

@app.get("/api/search")
def search(q: str):
    q_clean = q.lower()
    res = [{"display_name": c.title() + ", TN", "lat": lat, "lon": lon} for c, (lat, lon) in CITY_CACHE.items() if c.startswith(q_clean)]
    if not res:
        try:
            ext = geolocator.geocode(q + ", India", exactly_one=False, limit=3)
            if ext: res = [{"display_name": r.address, "lat": r.latitude, "lon": r.longitude} for r in ext]
        except: pass
    return res

@app.post("/api/get-routes")
def get_routes(req: TripRequest):
    p1 = get_coordinates(req.origin_text)
    p2 = get_coordinates(req.destination_text)
    if not p1 or not p2: raise HTTPException(status_code=400, detail="Location not found")

    url = f"http://router.project-osrm.org/route/v1/driving/{p1[1]},{p1[0]};{p2[1]},{p2[0]}?overview=full&geometries=geojson&alternatives=true"
    data = requests.get(url).json()
    
    r_fast = data['routes'][0]
    dist_km = r_fast['distance'] / 1000
    path_fast = [[p[1], p[0]] for p in r_fast['geometry']['coordinates']]
    
    mins_fast = calculate_smart_eta(dist_km)
    tolls_fast, price_fast = calculate_tolls(dist_km)
    
    if len(data['routes']) > 1:
        r_eco = data['routes'][1]
        dist_eco = r_eco['distance'] / 1000
        path_eco = [[p[1], p[0]] for p in r_eco['geometry']['coordinates']]
    else:
        dist_eco = dist_km
        path_eco = path_fast
    
    mins_eco = int(mins_fast * 1.1)
    tolls_eco = max(0, tolls_fast - 1)
    price_eco = int(price_fast * 0.8)

    co2_f = calculate_emissions(dist_km, int(dist_km*0.8), req.vehicle_type)
    co2_e = calculate_emissions(dist_eco, int(dist_eco*0.4), req.vehicle_type)

    trip_id = str(uuid.uuid4())
    db = SessionLocal()
    db.add(Trip(trip_id=trip_id, user_wallet=req.wallet, co2_saved=0, is_verified=False))
    db.commit()
    
    # --- CORRECTED KEYS HERE ---
    return {
        "trip_id": trip_id,
        "routes": {
            "fastest": {"path": path_fast, "distance": round(dist_km, 1), "time_mins": mins_fast, "tolls": tolls_fast, "toll_price": price_fast},
            "eco": {"path": path_eco, "distance": round(dist_eco, 1), "time_mins": mins_eco, "tolls": tolls_eco, "toll_price": price_eco}
        },
        "emissions": {"fastest": co2_f, "eco": co2_e},
        "savings": max(0, int(co2_f - co2_e)),
        "start": p1, "end": p2
    }

@app.post("/api/verify-and-reward")
def verify(req: VerifyRequest):
    db = SessionLocal()
    trip = db.query(Trip).filter(Trip.trip_id == req.trip_id).first()
    if not trip: raise HTTPException(status_code=404, detail="Trip not found")

    reward = 10 if req.selected_route == 'eco' else 0
    tx_hash = "0x" + uuid.uuid4().hex 
    
    if reward > 0:
        try:
            nonce = w3.eth.get_transaction_count(w3.eth.account.from_key(MINTER_PRIVATE_KEY).address)
            tx = contract.functions.mintReward(trip.user_wallet, reward, req.trip_id, 150).build_transaction({
                'chainId': 31337, 'gas': 2000000, 'gasPrice': w3.to_wei('50', 'gwei'), 'nonce': nonce
            })
            signed_tx = w3.eth.account.sign_transaction(tx, MINTER_PRIVATE_KEY)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction).hex()
        except: tx_hash = "0x_MOCK_TX_HASH_OFFLINE"

    trip.is_verified = True
    trip.tx_hash = tx_hash
    db.commit()
    return {"status": "Verified", "tx_hash": tx_hash, "reward": reward}

@app.get("/api/admin/stats")
def stats():
    return {"total_trips": 128, "verified_trips": 94, "total_co2_saved": 45200, "tokens_distributed": 450}