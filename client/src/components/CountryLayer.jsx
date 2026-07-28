import { GeoJSON } from "react-leaflet";
import countries from "../data/countries.json";


function CountryLayer() {


    function countryClicked(country) {

        console.log(
            country.properties.ADMIN
        );

    }


    return (

        <GeoJSON

            data={countries}

            style={{
                color: "#333",
                weight: 2,
                fillColor: "#ffffff",
                fillOpacity: 0.05
            }}

            eventHandlers={{

                click:(event)=>{

                    countryClicked(
                        event.layer.feature
                    );

                }

            }}

        />

    );

}


export default CountryLayer;