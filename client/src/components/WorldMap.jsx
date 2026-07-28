import {
  MapContainer,
  TileLayer
} from "react-leaflet";

import "leaflet/dist/leaflet.css";


function WorldMap() {

  return (

    <MapContainer
        center={[0, 0]}
        zoom={2}

        minZoom={2}

        maxZoom={8}

        maxBounds={[
            [-90, -180],
            [90, 180]
        ]}

        maxBoundsViscosity={1}

        worldCopyJump={false}

        style={{
            height:"100vh",
            width:"100%"
        }}
    >

      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

    </MapContainer>

  );

}


export default WorldMap;