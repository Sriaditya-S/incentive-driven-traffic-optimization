import osmnx as ox
import networkx as nx
import random

# Load map data for Vellore
PLACE_POINT = (12.9692, 79.1559) 
# dist=2000 is small/fast for testing. Increase for bigger map.
G = ox.graph_from_point(PLACE_POINT, dist=2000, network_type='drive')

# Add speeds and travel times (using the new v2.0 compatible logic if needed, 
# but falling back to standard if aliases exist)
try:
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)
except AttributeError:
    # Fallback for newer OSMnx versions if aliases changed
    G = ox.speed.add_edge_speeds(G)
    G = ox.speed.add_edge_travel_times(G)

def calculate_route_length(G, route):
    """
    Manual calculation of route length to avoid OSMnx version issues.
    Sum 'length' of all edges in the path.
    """
    length = 0.0
    if not route or len(route) < 2:
        return 0.0
        
    for u, v in zip(route[:-1], route[1:]):
        # Get edge data between node u and v. 
        # OSMnx graphs are MultiDiGraphs, so we access key [0]
        try:
            edge_data = G[u][v][0]
            length += edge_data.get('length', 0)
        except KeyError:
            continue
    return length

def get_best_routes(origin_lat, origin_lon, dest_lat, dest_lon):
    # Find nearest nodes on the map
    orig_node = ox.distance.nearest_nodes(G, origin_lon, origin_lat)
    dest_node = ox.distance.nearest_nodes(G, dest_lon, dest_lat)

    # 1. Calculate Fastest Route (Standard Dijkstra on travel_time)
    route_fastest = nx.shortest_path(G, orig_node, dest_node, weight='travel_time')
    
    # 2. Calculate Eco Route (Custom weighting)
    def eco_weight(u, v, d):
        length = d.get('length', 1)
        highway = d.get('highway', '')
        # Penalize main roads (simulating traffic density)
        if 'primary' in highway or 'trunk' in highway:
            return length * 2.0 
        return length

    route_eco = nx.shortest_path(G, orig_node, dest_node, weight=eco_weight)

    # Helper to convert nodes to coordinates for Frontend
    def get_coords(route):
        return [(G.nodes[n]['y'], G.nodes[n]['x']) for n in route]

    # Calculate metrics using our custom function
    fastest_dist = calculate_route_length(G, route_fastest)
    eco_dist = calculate_route_length(G, route_eco)

    return {
        "fastest": {
            "path": get_coords(route_fastest),
            "distance": fastest_dist,
            "stops": random.randint(8, 15) # Simulated High Traffic
        },
        "eco": {
            "path": get_coords(route_eco),
            "distance": eco_dist,
            "stops": random.randint(2, 5) # Simulated Low Traffic
        }
    }

def calculate_emissions(distance_meters, stops):
    # Base CO2 = 0.12g per meter
    # Stop Penalty = 15g per stop
    base_emission = distance_meters * 0.12
    stop_penalty = stops * 15.0
    return round(base_emission + stop_penalty, 2)