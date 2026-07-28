import { MapContainer, TileLayer } from "react-leaflet";
import CountryLayer from "./CountryLayer";
import "leaflet/dist/leaflet.css";

function WorldMap() {
    const worldBounds = [
        [-90, -180], 
        [90, 180]    
    ];

    return (
        <MapContainer 
            center={[20, 0]} 
            zoom={2} 
            minZoom={2}
            maxBounds={worldBounds}
            maxBoundsViscosity={1.0}
            worldCopyJump={false}
            style={{ height: "100vh", width: "100%" }}
        >
            <TileLayer
              url="https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=b2kWQSPaeDhJ5B2PDkVO"
              attribution='© MapTiler © OpenStreetMap contributors'
            />
            
            <CountryLayer />

        </MapContainer>
    );
}

export default WorldMap;