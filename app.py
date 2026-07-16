from flask import Flask, jsonify, render_template, request

from solver import calculate_heat_transfer
from multipleGlassLayer import calculate_multiple_glass_layer


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/calculate", methods=["POST"])
def calculate():
    try:
        data = request.get_json()

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Geçerli bir JSON verisi gönderilmedi.",
            }), 400

        model_mode = data.get("mode", "single")

        if model_mode == "single":
            result = calculate_single_glass(data)

        elif model_mode == "multiple":
            result = calculate_multiple_glass(data)

        else:
            return jsonify({
                "success": False,
                "error": "Geçersiz model modu.",
            }), 400

        return jsonify({
            "success": True,
            "mode": model_mode,
            "results": result,
        })

    except (TypeError, ValueError, KeyError) as error:
        return jsonify({
            "success": False,
            "error": str(error),
        }), 400

    except RuntimeError as error:
        return jsonify({
            "success": False,
            "error": str(error),
        }), 422

    except Exception:
        app.logger.exception(
            "Hesaplama sırasında beklenmeyen hata oluştu."
        )

        return jsonify({
            "success": False,
            "error": (
                "Hesaplama sırasında beklenmeyen "
                "bir sunucu hatası oluştu."
            ),
        }), 500


def calculate_single_glass(data: dict) -> dict:
    required_fields = [
        "oven_temperature_c",
        "room_temperature_c",
        "emissivity",
        "convection_coefficient",
        "glass_area",
    ]

    validate_required_fields(
        data=data,
        required_fields=required_fields,
    )

    result = calculate_heat_transfer(
        oven_temperature_c=float(
            data["oven_temperature_c"]
        ),
        room_temperature_c=float(
            data["room_temperature_c"]
        ),
        emissivity=float(
            data["emissivity"]
        ),
        convection_coefficient=float(
            data["convection_coefficient"]
        ),
        glass_area=float(
            data["glass_area"]
        ),
    )

    return result.to_dict()


def calculate_multiple_glass(data: dict) -> dict:
    required_fields = [
        "oven_temperature_c",
        "room_temperature_c",
        "hot_side_convection_coefficient",
        "cold_side_convection_coefficient",
        "glass_area",
        "glass_layers",
        "gaps",
    ]

    validate_required_fields(
        data=data,
        required_fields=required_fields,
    )

    glass_layers = data["glass_layers"]
    gaps = data["gaps"]

    if not isinstance(glass_layers, list):
        raise ValueError(
            "Cam katmanları liste biçiminde gönderilmelidir."
        )

    if not isinstance(gaps, list):
        raise ValueError(
            "Cam boşlukları liste biçiminde gönderilmelidir."
        )

    return calculate_multiple_glass_layer(
        oven_temperature_c=float(
            data["oven_temperature_c"]
        ),
        room_temperature_c=float(
            data["room_temperature_c"]
        ),
        hot_side_convection_coefficient=float(
            data["hot_side_convection_coefficient"]
        ),
        cold_side_convection_coefficient=float(
            data["cold_side_convection_coefficient"]
        ),
        glass_area=float(
            data["glass_area"]
        ),
        glass_layers=glass_layers,
        gaps=gaps,
    )


def validate_required_fields(
    data: dict,
    required_fields: list[str],
) -> None:
    missing_fields = [
        field
        for field in required_fields
        if field not in data
    ]

    if missing_fields:
        raise ValueError(
            "Eksik parametreler: "
            + ", ".join(missing_fields)
        )


if __name__ == "__main__":
    app.run(debug=False)