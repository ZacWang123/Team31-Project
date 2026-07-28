import { GeoJSON, useMap } from "react-leaflet";
import countries from "../data/countries.json";

function CountryLayer() {
    const map = useMap();

    const englishNames = {
        "Rossiya": "Russia",
        "Russian Federation": "Russia",
        "Deutschland": "Germany",
        "España": "Spain",
        "France": "France",
        "Italia": "Italy",
    };

    const customZoomViews = {
        "Russia": { center: [61.5240, 105.3188], zoom: 4 },
        "Brazil": { center: [-14.2350, -51.9253], zoom: 4 },
        "Argentina": { center: [-38.4161, -63.6167], zoom: 4 },
        "Chile": { center: [-35.6751, -71.5430], zoom: 4 },
        "New Zealand": { center: [-40.9006, 174.8860], zoom: 5 }
    };

    const onEachCountry = (feature, layer) => {
        const rawName = feature.properties.NAME || feature.properties.ADMIN || "Unknown";
        const countryName = englishNames[rawName] || rawName;

        const defaultStyle = {
            color: "#333333",
            weight: 1,
            fillColor: "#ffffff",
            fillOpacity: 0.05
        };

        // Apply default look and keep it static
        layer.setStyle(defaultStyle);

        layer.on({
            click: () => {
                console.log("Clicked Country:", countryName);

                if (customZoomViews[countryName]) {
                    const { center, zoom } = customZoomViews[countryName];
                    map.setView(center, zoom, { animate: true });
                    return;
                }

                const bounds = layer.getBounds();
                if (bounds.isValid()) {
                    map.flyToBounds(bounds, {
                        padding: [20, 20],
                        maxZoom: 8,
                        duration: 0.5
                    });
                }
            }
        });
    };

    return (
        <GeoJSON
            data={countries}
            onEachFeature={onEachCountry}
        />
    );
}

export default CountryLayer;