import {
  MapContainer,
  TileLayer
} from "react-leaflet";

import "leaflet/dist/leaflet.css";


function WorldMap() {

  return (

    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{
        height: "100vh",
        width: "100%"
      }}
    >

      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

    </MapContainer>

  );

}


export default WorldMap;