from dataclasses import asdict, dataclass


SIGMA = 5.670374419e-8


@dataclass
class SimulationResult:
    radiation_heat_flux: float
    convection_heat_flux: float
    total_heat_flux: float
    total_heat_rate: float

    def to_dict(self) -> dict:
        return asdict(self)


def calculate_heat_transfer(
    oven_temperature_c: float,
    room_temperature_c: float,
    emissivity: float,
    convection_coefficient: float,
    glass_area: float,
) -> SimulationResult:
    """
    Basitleştirilmiş ışınım ve taşınım hesabı.

    Dönüş değerleri:
        radiation_heat_flux: W/m²
        convection_heat_flux: W/m²
        total_heat_flux: W/m²
        total_heat_rate: W
    """

    if oven_temperature_c <= -273.15:
        raise ValueError(
            "Fırın sıcaklığı mutlak sıfırın üzerinde olmalıdır."
        )

    if room_temperature_c <= -273.15:
        raise ValueError(
            "Ortam sıcaklığı mutlak sıfırın üzerinde olmalıdır."
        )

    if not 0 <= emissivity <= 1:
        raise ValueError(
            "Emissivite 0 ile 1 arasında olmalıdır."
        )

    if convection_coefficient < 0:
        raise ValueError(
            "Taşınım katsayısı negatif olamaz."
        )

    if glass_area <= 0:
        raise ValueError(
            "Cam alanı sıfırdan büyük olmalıdır."
        )

    oven_temperature_k = oven_temperature_c + 273.15
    room_temperature_k = room_temperature_c + 273.15

    radiation_heat_flux = (
        emissivity
        * SIGMA
        * (
            oven_temperature_k**4
            - room_temperature_k**4
        )
    )

    convection_heat_flux = (
        convection_coefficient
        * (
            oven_temperature_c
            - room_temperature_c
        )
    )

    total_heat_flux = (
        radiation_heat_flux
        + convection_heat_flux
    )

    total_heat_rate = (
        total_heat_flux
        * glass_area
    )

    return SimulationResult(
        radiation_heat_flux=radiation_heat_flux,
        convection_heat_flux=convection_heat_flux,
        total_heat_flux=total_heat_flux,
        total_heat_rate=total_heat_rate,
    )