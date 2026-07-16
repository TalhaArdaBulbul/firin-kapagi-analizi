from typing import Any

import numpy as np
from scipy.optimize import least_squares


SIGMA = 5.670374419e-8


def calculate_multiple_glass_layer(
    oven_temperature_c: float,
    room_temperature_c: float,
    hot_side_convection_coefficient: float,
    cold_side_convection_coefficient: float,
    glass_area: float,
    glass_layers: list[dict[str, float]],
    gaps: list[dict[str, float]],
) -> dict[str, Any]:
    """
    Çok katmanlı fırın camının kararlı, bir boyutlu
    ısı transferi analizini yapar.

    Her cam katmanı için:
        - kalınlık
        - ısıl iletkenlik
        - emissivite

    Her cam boşluğu için:
        - boşluk kalınlığı
        - gazın ısıl iletkenliği

    Cam boşluklarında:
        - gaz iletimi
        - yüzeyler arası ışınım

    birlikte hesaba katılır.
    """

    _validate_main_inputs(
        oven_temperature_c=oven_temperature_c,
        room_temperature_c=room_temperature_c,
        hot_side_convection_coefficient=(
            hot_side_convection_coefficient
        ),
        cold_side_convection_coefficient=(
            cold_side_convection_coefficient
        ),
        glass_area=glass_area,
        glass_layers=glass_layers,
        gaps=gaps,
    )

    normalized_layers = _normalize_glass_layers(
        glass_layers
    )

    normalized_gaps = _normalize_gaps(
        gaps
    )

    number_of_glasses = len(normalized_layers)

    hot_temperature_k = oven_temperature_c + 273.15
    cold_temperature_k = room_temperature_c + 273.15

    initial_guess = _create_initial_guess(
        hot_temperature_k=hot_temperature_k,
        cold_temperature_k=cold_temperature_k,
        hot_side_convection_coefficient=(
            hot_side_convection_coefficient
        ),
        cold_side_convection_coefficient=(
            cold_side_convection_coefficient
        ),
        glass_layers=normalized_layers,
        gaps=normalized_gaps,
    )

    initial_heat_flux = initial_guess[-1]
    residual_scale = max(abs(initial_heat_flux), 100.0)

    def raw_residuals(
        unknowns: np.ndarray,
    ) -> np.ndarray:
        surface_temperatures = unknowns[:-1]
        heat_flux = unknowns[-1]

        residuals: list[float] = []

        first_surface_temperature = (
            surface_temperatures[0]
        )

        first_emissivity = normalized_layers[0][
            "emissivity"
        ]

        hot_convection_flux = (
            hot_side_convection_coefficient
            * (
                hot_temperature_k
                - first_surface_temperature
            )
        )

        hot_radiation_flux = (
            first_emissivity
            * SIGMA
            * (
                hot_temperature_k**4
                - first_surface_temperature**4
            )
        )

        residuals.append(
            heat_flux
            - hot_convection_flux
            - hot_radiation_flux
        )

        for layer_index, layer in enumerate(
            normalized_layers
        ):
            left_surface = surface_temperatures[
                2 * layer_index
            ]

            right_surface = surface_temperatures[
                2 * layer_index + 1
            ]

            glass_conduction_flux = (
                layer["conductivity"]
                * (left_surface - right_surface)
                / layer["thickness_m"]
            )

            residuals.append(
                heat_flux - glass_conduction_flux
            )

            if layer_index < number_of_glasses - 1:
                next_left_surface = (
                    surface_temperatures[
                        2 * (layer_index + 1)
                    ]
                )

                gap = normalized_gaps[layer_index]

                gap_conduction_flux = (
                    gap["gas_conductivity"]
                    * (
                        right_surface
                        - next_left_surface
                    )
                    / gap["thickness_m"]
                )

                left_emissivity = normalized_layers[
                    layer_index
                ]["emissivity"]

                right_emissivity = normalized_layers[
                    layer_index + 1
                ]["emissivity"]

                emissivity_denominator = (
                    1 / left_emissivity
                    + 1 / right_emissivity
                    - 1
                )

                gap_radiation_flux = (
                    SIGMA
                    * (
                        right_surface**4
                        - next_left_surface**4
                    )
                    / emissivity_denominator
                )

                residuals.append(
                    heat_flux
                    - gap_conduction_flux
                    - gap_radiation_flux
                )

        last_surface_temperature = (
            surface_temperatures[-1]
        )

        last_emissivity = normalized_layers[-1][
            "emissivity"
        ]

        cold_convection_flux = (
            cold_side_convection_coefficient
            * (
                last_surface_temperature
                - cold_temperature_k
            )
        )

        cold_radiation_flux = (
            last_emissivity
            * SIGMA
            * (
                last_surface_temperature**4
                - cold_temperature_k**4
            )
        )

        residuals.append(
            heat_flux
            - cold_convection_flux
            - cold_radiation_flux
        )

        return np.asarray(
            residuals,
            dtype=float,
        )

    def scaled_residuals(
        unknowns: np.ndarray,
    ) -> np.ndarray:
        return (
            raw_residuals(unknowns)
            / residual_scale
        )

    upper_temperature_bound = (
        max(
            hot_temperature_k,
            cold_temperature_k,
        )
        + 1500
    )

    lower_bounds = np.concatenate(
        [
            np.full(
                2 * number_of_glasses,
                1.0,
            ),
            np.array([-1.0e7]),
        ]
    )

    upper_bounds = np.concatenate(
        [
            np.full(
                2 * number_of_glasses,
                upper_temperature_bound,
            ),
            np.array([1.0e7]),
        ]
    )

    solution = least_squares(
        scaled_residuals,
        initial_guess,
        bounds=(
            lower_bounds,
            upper_bounds,
        ),
        x_scale="jac",
        max_nfev=5000,
        ftol=1.0e-11,
        xtol=1.0e-11,
        gtol=1.0e-11,
    )

    if not solution.success:
        raise RuntimeError(
            "Çoklu cam enerji denklemleri "
            "yakınsamadı: "
            + solution.message
        )

    surface_temperatures_k = solution.x[:-1]
    heat_flux = float(solution.x[-1])

    energy_balance_error = float(
        np.max(
            np.abs(
                raw_residuals(solution.x)
            )
        )
    )

    first_surface_temperature = (
        surface_temperatures_k[0]
    )

    last_surface_temperature = (
        surface_temperatures_k[-1]
    )

    hot_convection_flux = float(
        hot_side_convection_coefficient
        * (
            hot_temperature_k
            - first_surface_temperature
        )
    )

    hot_radiation_flux = float(
        normalized_layers[0]["emissivity"]
        * SIGMA
        * (
            hot_temperature_k**4
            - first_surface_temperature**4
        )
    )

    cold_convection_flux = float(
        cold_side_convection_coefficient
        * (
            last_surface_temperature
            - cold_temperature_k
        )
    )

    cold_radiation_flux = float(
        normalized_layers[-1]["emissivity"]
        * SIGMA
        * (
            last_surface_temperature**4
            - cold_temperature_k**4
        )
    )

    layer_results = _create_layer_results(
        surface_temperatures_k=(
            surface_temperatures_k
        ),
        glass_layers=normalized_layers,
    )

    gap_results = _create_gap_results(
        surface_temperatures_k=(
            surface_temperatures_k
        ),
        glass_layers=normalized_layers,
        gaps=normalized_gaps,
    )

    return {
        "heat_flux": heat_flux,
        "total_heat_rate": (
            heat_flux * glass_area
        ),
        "hot_side": {
            "convection_heat_flux": (
                hot_convection_flux
            ),
            "radiation_heat_flux": (
                hot_radiation_flux
            ),
            "total_heat_flux": (
                hot_convection_flux
                + hot_radiation_flux
            ),
        },
        "cold_side": {
            "convection_heat_flux": (
                cold_convection_flux
            ),
            "radiation_heat_flux": (
                cold_radiation_flux
            ),
            "total_heat_flux": (
                cold_convection_flux
                + cold_radiation_flux
            ),
        },
        "glass_layers": layer_results,
        "gaps": gap_results,
        "energy_balance_error": (
            energy_balance_error
        ),
        "solver_iterations": int(
            solution.nfev
        ),
    }


def _validate_main_inputs(
    oven_temperature_c: float,
    room_temperature_c: float,
    hot_side_convection_coefficient: float,
    cold_side_convection_coefficient: float,
    glass_area: float,
    glass_layers: list[dict[str, float]],
    gaps: list[dict[str, float]],
) -> None:
    if (
        oven_temperature_c <= -273.15
        or room_temperature_c <= -273.15
    ):
        raise ValueError(
            "Sıcaklıklar mutlak sıfırın "
            "üzerinde olmalıdır."
        )

    if hot_side_convection_coefficient < 0:
        raise ValueError(
            "İç taşınım katsayısı "
            "negatif olamaz."
        )

    if cold_side_convection_coefficient < 0:
        raise ValueError(
            "Dış taşınım katsayısı "
            "negatif olamaz."
        )

    if glass_area <= 0:
        raise ValueError(
            "Cam alanı sıfırdan büyük olmalıdır."
        )

    number_of_glasses = len(glass_layers)

    if number_of_glasses < 2:
        raise ValueError(
            "Çoklu cam modeli için en az "
            "iki cam katmanı gerekir."
        )

    if number_of_glasses > 6:
        raise ValueError(
            "Bu sürüm en fazla altı cam "
            "katmanını destekler."
        )

    if len(gaps) != number_of_glasses - 1:
        raise ValueError(
            "Boşluk sayısı, cam sayısından "
            "bir eksik olmalıdır."
        )


def _normalize_glass_layers(
    glass_layers: list[dict[str, float]],
) -> list[dict[str, float]]:
    normalized_layers: list[dict[str, float]] = []

    for index, layer in enumerate(
        glass_layers,
        start=1,
    ):
        try:
            thickness_m = (
                float(layer["thickness_mm"])
                / 1000
            )

            conductivity = float(
                layer["conductivity"]
            )

            emissivity = float(
                layer["emissivity"]
            )

        except (
            KeyError,
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                f"{index}. cam katmanının "
                "verileri geçersiz."
            ) from error

        if thickness_m <= 0:
            raise ValueError(
                f"{index}. cam kalınlığı "
                "sıfırdan büyük olmalıdır."
            )

        if conductivity <= 0:
            raise ValueError(
                f"{index}. camın ısıl iletkenliği "
                "sıfırdan büyük olmalıdır."
            )

        if not 0 < emissivity <= 1:
            raise ValueError(
                f"{index}. cam emissivitesi "
                "0 ile 1 arasında olmalıdır."
            )

        normalized_layers.append(
            {
                "thickness_m": thickness_m,
                "conductivity": conductivity,
                "emissivity": emissivity,
            }
        )

    return normalized_layers


def _normalize_gaps(
    gaps: list[dict[str, float]],
) -> list[dict[str, float]]:
    normalized_gaps: list[dict[str, float]] = []

    for index, gap in enumerate(
        gaps,
        start=1,
    ):
        try:
            thickness_m = (
                float(gap["thickness_mm"])
                / 1000
            )

            gas_conductivity = float(
                gap["gas_conductivity"]
            )

        except (
            KeyError,
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                f"{index}. cam boşluğunun "
                "verileri geçersiz."
            ) from error

        if thickness_m <= 0:
            raise ValueError(
                f"{index}. cam boşluğu "
                "sıfırdan büyük olmalıdır."
            )

        if gas_conductivity <= 0:
            raise ValueError(
                f"{index}. boşluğun gaz "
                "iletkenliği sıfırdan büyük olmalıdır."
            )

        normalized_gaps.append(
            {
                "thickness_m": thickness_m,
                "gas_conductivity": (
                    gas_conductivity
                ),
            }
        )

    return normalized_gaps


def _create_initial_guess(
    hot_temperature_k: float,
    cold_temperature_k: float,
    hot_side_convection_coefficient: float,
    cold_side_convection_coefficient: float,
    glass_layers: list[dict[str, float]],
    gaps: list[dict[str, float]],
) -> np.ndarray:
    number_of_glasses = len(glass_layers)

    glass_resistance = sum(
        layer["thickness_m"]
        / layer["conductivity"]
        for layer in glass_layers
    )

    gap_resistance = sum(
        gap["thickness_m"]
        / gap["gas_conductivity"]
        for gap in gaps
    )

    hot_film_resistance = (
        1 / hot_side_convection_coefficient
        if hot_side_convection_coefficient > 0
        else 0
    )

    cold_film_resistance = (
        1 / cold_side_convection_coefficient
        if cold_side_convection_coefficient > 0
        else 0
    )

    approximate_resistance = (
        glass_resistance
        + gap_resistance
        + hot_film_resistance
        + cold_film_resistance
    )

    if approximate_resistance <= 0:
        approximate_resistance = 1

    initial_heat_flux = (
        hot_temperature_k
        - cold_temperature_k
    ) / approximate_resistance

    initial_surface_temperatures = np.linspace(
        hot_temperature_k,
        cold_temperature_k,
        2 * number_of_glasses + 2,
    )[1:-1]

    return np.concatenate(
        [
            initial_surface_temperatures,
            np.array([initial_heat_flux]),
        ]
    )


def _create_layer_results(
    surface_temperatures_k: np.ndarray,
    glass_layers: list[dict[str, float]],
) -> list[dict[str, float]]:
    results: list[dict[str, float]] = []

    for layer_index, layer in enumerate(
        glass_layers
    ):
        results.append(
            {
                "index": layer_index + 1,
                "inner_surface_temperature_c": (
                    float(
                        surface_temperatures_k[
                            2 * layer_index
                        ]
                        - 273.15
                    )
                ),
                "outer_surface_temperature_c": (
                    float(
                        surface_temperatures_k[
                            2 * layer_index + 1
                        ]
                        - 273.15
                    )
                ),
                "thickness_mm": (
                    layer["thickness_m"] * 1000
                ),
                "conductivity": (
                    layer["conductivity"]
                ),
                "emissivity": (
                    layer["emissivity"]
                ),
            }
        )

    return results


def _create_gap_results(
    surface_temperatures_k: np.ndarray,
    glass_layers: list[dict[str, float]],
    gaps: list[dict[str, float]],
) -> list[dict[str, float]]:
    results: list[dict[str, float]] = []

    for gap_index, gap in enumerate(gaps):
        left_surface_k = (
            surface_temperatures_k[
                2 * gap_index + 1
            ]
        )

        right_surface_k = (
            surface_temperatures_k[
                2 * (gap_index + 1)
            ]
        )

        conduction_flux = (
            gap["gas_conductivity"]
            * (
                left_surface_k
                - right_surface_k
            )
            / gap["thickness_m"]
        )

        left_emissivity = glass_layers[
            gap_index
        ]["emissivity"]

        right_emissivity = glass_layers[
            gap_index + 1
        ]["emissivity"]

        denominator = (
            1 / left_emissivity
            + 1 / right_emissivity
            - 1
        )

        radiation_flux = (
            SIGMA
            * (
                left_surface_k**4
                - right_surface_k**4
            )
            / denominator
        )

        results.append(
            {
                "index": gap_index + 1,
                "left_surface_temperature_c": (
                    float(
                        left_surface_k - 273.15
                    )
                ),
                "right_surface_temperature_c": (
                    float(
                        right_surface_k - 273.15
                    )
                ),
                "conduction_heat_flux": (
                    float(conduction_flux)
                ),
                "radiation_heat_flux": (
                    float(radiation_flux)
                ),
                "total_heat_flux": float(
                    conduction_flux
                    + radiation_flux
                ),
                "thickness_mm": (
                    gap["thickness_m"] * 1000
                ),
                "gas_conductivity": (
                    gap["gas_conductivity"]
                ),
            }
        )

    return results