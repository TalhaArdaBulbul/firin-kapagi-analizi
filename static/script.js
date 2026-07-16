const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

let currentMode = "single";


const calculateButton = document.getElementById(
    "calculate-button"
);

const modelToggleButton = document.getElementById(
    "model-toggle-button"
);

const modelModeLabel = document.getElementById(
    "model-mode-label"
);

const inputPanelDescription = document.getElementById(
    "input-panel-description"
);

const singleGlassInputs = document.getElementById(
    "single-glass-inputs"
);

const multipleGlassInputs = document.getElementById(
    "multiple-glass-inputs"
);

const multipleResultsSection = document.getElementById(
    "multiple-results-section"
);

const glassCountInput = document.getElementById(
    "glass-count"
);

const dynamicLayerInputs = document.getElementById(
    "dynamic-layer-inputs"
);

const dynamicGlassGroup = document.getElementById(
    "dynamic-glass-group"
);

const modelGlassTitle = document.getElementById(
    "model-glass-title"
);

const modelNote = document.getElementById(
    "model-note"
);

const radiationResult = document.getElementById(
    "radiation-result"
);

const convectionResult = document.getElementById(
    "convection-result"
);

const totalFluxResult = document.getElementById(
    "total-flux-result"
);

const totalRateResult = document.getElementById(
    "total-rate-result"
);

const radiationShare = document.getElementById(
    "radiation-share"
);

const convectionShare = document.getElementById(
    "convection-share"
);

const modelStatusText = document.getElementById(
    "model-status-text"
);

const modelOvenTemperature = document.getElementById(
    "model-oven-temperature"
);

const modelRoomTemperature = document.getElementById(
    "model-room-temperature"
);

const modelRadiationValue = document.getElementById(
    "model-radiation-value"
);

const modelConvectionValue = document.getElementById(
    "model-convection-value"
);

const modelTotalValue = document.getElementById(
    "model-total-value"
);

const heatModel = document.getElementById(
    "heat-model"
);

const layerResultsBody = document.getElementById(
    "layer-results-body"
);

const gapResultsBody = document.getElementById(
    "gap-results-body"
);

const energyBalanceError = document.getElementById(
    "energy-balance-error"
);

const solverIterations = document.getElementById(
    "solver-iterations"
);


function getNumericInput(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(
            `${id} isimli giriş alanı bulunamadı.`
        );
    }

    const value = Number(element.value);

    if (!Number.isFinite(value)) {
        throw new Error(
            `${id} için geçerli bir sayı girilmelidir.`
        );
    }

    return value;
}


function formatNumber(value, unit) {
    return `${Number(value).toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })} ${unit}`;
}


function formatTemperature(value) {
    return `${Number(value).toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })} °C`;
}


function formatPercent(value) {
    return `${Number(value).toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })} %`;
}


function setLoadingState(isLoading) {
    calculateButton.disabled = isLoading;

    calculateButton.textContent = isLoading
        ? "Hesaplanıyor..."
        : "Hesapla";

    if (isLoading) {
        modelStatusText.textContent =
            "Enerji denklemleri çözülüyor";
    }
}


function clearResults() {
    radiationResult.textContent = "—";
    convectionResult.textContent = "—";
    totalFluxResult.textContent = "—";
    totalRateResult.textContent = "—";

    radiationShare.textContent = "—";
    convectionShare.textContent = "—";

    modelRadiationValue.textContent = "q″rad = —";
    modelConvectionValue.textContent = "q″conv = —";
    modelTotalValue.textContent = "Q̇ = —";

    layerResultsBody.innerHTML = "";
    gapResultsBody.innerHTML = "";

    energyBalanceError.textContent = "—";
    solverIterations.textContent = "—";

    modelStatusText.textContent =
        "Hesaplama bekleniyor";
}


function createInputMarkup({
    id,
    label,
    value,
    step,
    min,
    max,
    unit,
    fullWidth = false,
}) {
    const fullWidthClass = fullWidth
        ? " full-width"
        : "";

    const minimumAttribute = min !== undefined
        ? `min="${min}"`
        : "";

    const maximumAttribute = max !== undefined
        ? `max="${max}"`
        : "";

    if (unit) {
        return `
            <div class="form-group${fullWidthClass}">
                <label for="${id}">
                    ${label}
                </label>

                <div class="input-wrapper">
                    <input
                        id="${id}"
                        type="number"
                        value="${value}"
                        step="${step}"
                        ${minimumAttribute}
                        ${maximumAttribute}
                    >

                    <span>${unit}</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="form-group${fullWidthClass}">
            <label for="${id}">
                ${label}
            </label>

            <input
                id="${id}"
                type="number"
                value="${value}"
                step="${step}"
                ${minimumAttribute}
                ${maximumAttribute}
            >
        </div>
    `;
}


function readExistingLayerValues() {
    const values = {
        layers: [],
        gaps: [],
    };

    const existingLayerCount = Number(
        glassCountInput.value
    );

    for (
        let index = 1;
        index <= existingLayerCount;
        index += 1
    ) {
        const thicknessElement = document.getElementById(
            `glass-${index}-thickness`
        );

        const conductivityElement = document.getElementById(
            `glass-${index}-conductivity`
        );

        const emissivityElement = document.getElementById(
            `glass-${index}-emissivity`
        );

        if (
            thicknessElement
            && conductivityElement
            && emissivityElement
        ) {
            values.layers.push({
                thickness: thicknessElement.value,
                conductivity: conductivityElement.value,
                emissivity: emissivityElement.value,
            });
        }

        if (index < existingLayerCount) {
            const gapThicknessElement =
                document.getElementById(
                    `gap-${index}-thickness`
                );

            const gasConductivityElement =
                document.getElementById(
                    `gap-${index}-conductivity`
                );

            if (
                gapThicknessElement
                && gasConductivityElement
            ) {
                values.gaps.push({
                    thickness: gapThicknessElement.value,
                    conductivity:
                        gasConductivityElement.value,
                });
            }
        }
    }

    return values;
}


function renderLayerInputs(numberOfGlasses) {
    const previousValues = readExistingLayerValues();

    dynamicLayerInputs.innerHTML = "";

    for (
        let index = 1;
        index <= numberOfGlasses;
        index += 1
    ) {
        const previousLayer =
            previousValues.layers[index - 1];

        const layerCard = document.createElement("div");
        layerCard.className = "layer-input-card";

        layerCard.innerHTML = `
            <div class="layer-card-title">
                <strong>Cam ${index}</strong>

                <span>
                    ${index === 1
                        ? "Fırına en yakın"
                        : index === numberOfGlasses
                            ? "Ortama en yakın"
                            : "Ara katman"}
                </span>
            </div>

            <div class="mini-input-grid">
                ${createInputMarkup({
                    id: `glass-${index}-thickness`,
                    label: "Kalınlık",
                    value: previousLayer?.thickness ?? 4,
                    step: 0.5,
                    min: 0.1,
                    unit: "mm",
                })}

                ${createInputMarkup({
                    id: `glass-${index}-conductivity`,
                    label: "Isıl iletkenlik",
                    value: previousLayer?.conductivity ?? 1.0,
                    step: 0.05,
                    min: 0.01,
                    unit: "W/mK",
                })}

                ${createInputMarkup({
                    id: `glass-${index}-emissivity`,
                    label: "Emissivite",
                    value: previousLayer?.emissivity ?? 0.84,
                    step: 0.01,
                    min: 0.01,
                    max: 1,
                    fullWidth: true,
                })}
            </div>
        `;

        dynamicLayerInputs.appendChild(layerCard);

        if (index < numberOfGlasses) {
            const previousGap =
                previousValues.gaps[index - 1];

            const gapCard = document.createElement("div");
            gapCard.className = "gap-input-card";

            gapCard.innerHTML = `
                <div class="gap-card-title">
                    <strong>Boşluk ${index}</strong>
                    <span>Cam ${index} – Cam ${index + 1}</span>
                </div>

                <div class="mini-input-grid">
                    ${createInputMarkup({
                        id: `gap-${index}-thickness`,
                        label: "Boşluk kalınlığı",
                        value: previousGap?.thickness ?? 10,
                        step: 1,
                        min: 0.1,
                        unit: "mm",
                    })}

                    ${createInputMarkup({
                        id: `gap-${index}-conductivity`,
                        label: "Gaz iletkenliği",
                        value: previousGap?.conductivity ?? 0.026,
                        step: 0.001,
                        min: 0.001,
                        unit: "W/mK",
                    })}
                </div>
            `;

            dynamicLayerInputs.appendChild(gapCard);
        }
    }
}


function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS(
        SVG_NAMESPACE,
        tagName
    );

    Object.entries(attributes).forEach(
        ([attributeName, value]) => {
            element.setAttribute(
                attributeName,
                String(value)
            );
        }
    );

    return element;
}


function renderGlassSchematic(numberOfGlasses) {
    dynamicGlassGroup.innerHTML = "";

    const zoneStart = 515;
    const zoneEnd = 625;
    const zoneWidth = zoneEnd - zoneStart;

    const paneWidth = numberOfGlasses <= 3
        ? 14
        : 10;

    const totalPaneWidth =
        paneWidth * numberOfGlasses;

    const gapWidth = numberOfGlasses > 1
        ? (
            zoneWidth - totalPaneWidth
        ) / (numberOfGlasses - 1)
        : 0;

    const singlePaneOffset = numberOfGlasses === 1
        ? (zoneWidth - paneWidth) / 2
        : 0;

    for (
        let index = 0;
        index < numberOfGlasses;
        index += 1
    ) {
        const xPosition =
            zoneStart
            + singlePaneOffset
            + index * (paneWidth + gapWidth);

        if (index > 0) {
            const previousPaneX =
                zoneStart
                + singlePaneOffset
                + (index - 1)
                * (paneWidth + gapWidth);

            const gapStart =
                previousPaneX + paneWidth;

            const gapRectangle = createSvgElement(
                "rect",
                {
                    x: gapStart,
                    y: 112,
                    width: gapWidth,
                    height: 235,
                    rx: 3,
                    class: "gap-zone",
                }
            );

            dynamicGlassGroup.appendChild(
                gapRectangle
            );
        }

        const glassRectangle = createSvgElement(
            "rect",
            {
                id: `model-glass-${index + 1}`,
                x: xPosition,
                y: 105,
                width: paneWidth,
                height: 249,
                rx: 4,
                class: "dynamic-glass-pane",
                fill: "rgba(125, 211, 252, 0.65)",
            }
        );

        dynamicGlassGroup.appendChild(
            glassRectangle
        );

        const glassLabel = createSvgElement(
            "text",
            {
                x: xPosition + paneWidth / 2,
                y: 372,
                "text-anchor": "middle",
                class: "glass-index-label",
            }
        );

        glassLabel.textContent = `${index + 1}`;

        dynamicGlassGroup.appendChild(
            glassLabel
        );
    }

    modelGlassTitle.textContent =
        numberOfGlasses === 1
            ? "CAM"
            : `${numberOfGlasses} CAM KATMANI`;
}


function updateModeInterface() {
    const isSingleMode = currentMode === "single";

    singleGlassInputs.hidden = !isSingleMode;
    multipleGlassInputs.hidden = isSingleMode;
    multipleResultsSection.hidden = isSingleMode;

    if (isSingleMode) {
        modelModeLabel.textContent =
            "Basitleştirilmiş Tek Cam Modeli";

        inputPanelDescription.textContent =
            "Tek cam hesaplama parametreleri";

        modelNote.textContent =
            "Tek cam modeli, fırın ve ortam sıcaklıkları "
            + "arasındaki ışınım ve taşınım bileşenlerini "
            + "karşılaştırır.";

        renderGlassSchematic(1);

    } else {
        modelModeLabel.textContent =
            "Çok Katmanlı Cam Modeli";

        inputPanelDescription.textContent =
            "Cam katmanları ve gaz boşlukları";

        modelNote.textContent =
            "Çoklu cam modelinde cam katmanlarında iletim, "
            + "boşluklarda gaz iletimi ve karşılıklı yüzey "
            + "ışınımı aynı anda çözülür.";

        const numberOfGlasses = Number(
            glassCountInput.value
        );

        renderLayerInputs(numberOfGlasses);
        renderGlassSchematic(numberOfGlasses);
    }

    clearResults();
}


function buildSingleGlassPayload() {
    return {
        mode: "single",

        oven_temperature_c: getNumericInput(
            "oven-temperature"
        ),

        room_temperature_c: getNumericInput(
            "room-temperature"
        ),

        emissivity: getNumericInput(
            "emissivity"
        ),

        convection_coefficient: getNumericInput(
            "convection-coefficient"
        ),

        glass_area: getNumericInput(
            "glass-area"
        ),
    };
}


function buildMultipleGlassPayload() {
    const numberOfGlasses = Number(
        glassCountInput.value
    );

    const glassLayers = [];
    const gaps = [];

    for (
        let index = 1;
        index <= numberOfGlasses;
        index += 1
    ) {
        glassLayers.push({
            thickness_mm: getNumericInput(
                `glass-${index}-thickness`
            ),

            conductivity: getNumericInput(
                `glass-${index}-conductivity`
            ),

            emissivity: getNumericInput(
                `glass-${index}-emissivity`
            ),
        });

        if (index < numberOfGlasses) {
            gaps.push({
                thickness_mm: getNumericInput(
                    `gap-${index}-thickness`
                ),

                gas_conductivity: getNumericInput(
                    `gap-${index}-conductivity`
                ),
            });
        }
    }

    return {
        mode: "multiple",

        oven_temperature_c: getNumericInput(
            "oven-temperature"
        ),

        room_temperature_c: getNumericInput(
            "room-temperature"
        ),

        hot_side_convection_coefficient:
            getNumericInput(
                "hot-side-convection-coefficient"
            ),

        cold_side_convection_coefficient:
            getNumericInput(
                "cold-side-convection-coefficient"
            ),

        glass_area: getNumericInput(
            "glass-area"
        ),

        glass_layers: glassLayers,
        gaps,
    };
}


function updateMechanismShares(
    radiationHeatFlux,
    convectionHeatFlux
) {
    const radiationMagnitude = Math.abs(
        radiationHeatFlux
    );

    const convectionMagnitude = Math.abs(
        convectionHeatFlux
    );

    const totalMagnitude =
        radiationMagnitude + convectionMagnitude;

    const radiationPercentage = totalMagnitude > 0
        ? radiationMagnitude / totalMagnitude * 100
        : 0;

    const convectionPercentage = totalMagnitude > 0
        ? convectionMagnitude / totalMagnitude * 100
        : 0;

    radiationShare.textContent = formatPercent(
        radiationPercentage
    );

    convectionShare.textContent = formatPercent(
        convectionPercentage
    );

    heatModel.style.setProperty(
        "--rad-opacity",
        String(
            0.22 + 0.78 * radiationPercentage / 100
        )
    );

    heatModel.style.setProperty(
        "--conv-opacity",
        String(
            0.22 + 0.78 * convectionPercentage / 100
        )
    );
}


function temperatureToGlassColor(
    temperatureC,
    coldTemperatureC,
    hotTemperatureC
) {
    const denominator =
        hotTemperatureC - coldTemperatureC;

    const normalizedTemperature =
        Math.abs(denominator) > 1e-9
            ? (
                temperatureC - coldTemperatureC
            ) / denominator
            : 0.5;

    const level = Math.max(
        0,
        Math.min(1, normalizedTemperature)
    );

    const red = Math.round(
        85 + 170 * level
    );

    const green = Math.round(
        190 - 80 * level
    );

    const blue = Math.round(
        235 - 150 * level
    );

    return `rgba(${red}, ${green}, ${blue}, 0.78)`;
}


function updateSingleGlassResults(
    parameters,
    results
) {
    const radiationFlux =
        results.radiation_heat_flux;

    const convectionFlux =
        results.convection_heat_flux;

    radiationResult.textContent = formatNumber(
        radiationFlux,
        "W/m²"
    );

    convectionResult.textContent = formatNumber(
        convectionFlux,
        "W/m²"
    );

    totalFluxResult.textContent = formatNumber(
        results.total_heat_flux,
        "W/m²"
    );

    totalRateResult.textContent = formatNumber(
        results.total_heat_rate,
        "W"
    );

    modelRadiationValue.textContent =
        `q″rad = ${formatNumber(
            radiationFlux,
            "W/m²"
        )}`;

    modelConvectionValue.textContent =
        `q″conv = ${formatNumber(
            convectionFlux,
            "W/m²"
        )}`;

    modelTotalValue.textContent =
        `Q̇ = ${formatNumber(
            results.total_heat_rate,
            "W"
        )}`;

    updateMechanismShares(
        radiationFlux,
        convectionFlux
    );

    const glassElement = document.getElementById(
        "model-glass-1"
    );

    if (glassElement) {
        const approximateTemperature =
            (
                parameters.oven_temperature_c
                + parameters.room_temperature_c
            ) / 2;

        glassElement.style.fill =
            temperatureToGlassColor(
                approximateTemperature,
                parameters.room_temperature_c,
                parameters.oven_temperature_c
            );
    }

    modelStatusText.textContent =
        "Tek cam hesabı tamamlandı";
}


function updateMultipleLayerTable(layers) {
    layerResultsBody.innerHTML = "";

    layers.forEach((layer) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>Cam ${layer.index}</td>

            <td>
                ${formatTemperature(
                    layer.inner_surface_temperature_c
                )}
            </td>

            <td>
                ${formatTemperature(
                    layer.outer_surface_temperature_c
                )}
            </td>
        `;

        layerResultsBody.appendChild(row);
    });
}


function updateMultipleGapTable(gaps) {
    gapResultsBody.innerHTML = "";

    gaps.forEach((gap) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>Boşluk ${gap.index}</td>

            <td>
                ${formatNumber(
                    gap.conduction_heat_flux,
                    "W/m²"
                )}
            </td>

            <td>
                ${formatNumber(
                    gap.radiation_heat_flux,
                    "W/m²"
                )}
            </td>
        `;

        gapResultsBody.appendChild(row);
    });
}


function updateMultipleGlassColors(
    parameters,
    layers
) {
    layers.forEach((layer) => {
        const glassElement = document.getElementById(
            `model-glass-${layer.index}`
        );

        if (!glassElement) {
            return;
        }

        const averageTemperature =
            (
                layer.inner_surface_temperature_c
                + layer.outer_surface_temperature_c
            ) / 2;

        glassElement.style.fill =
            temperatureToGlassColor(
                averageTemperature,
                parameters.room_temperature_c,
                parameters.oven_temperature_c
            );

        if (
            averageTemperature
            > (
                parameters.room_temperature_c
                + 0.6
                * (
                    parameters.oven_temperature_c
                    - parameters.room_temperature_c
                )
            )
        ) {
            glassElement.style.filter =
                "url(#heat-glow)";
        } else {
            glassElement.style.filter = "none";
        }
    });
}


function updateMultipleGlassResults(
    parameters,
    results
) {
    const radiationFlux =
        results.hot_side.radiation_heat_flux;

    const convectionFlux =
        results.hot_side.convection_heat_flux;

    radiationResult.textContent = formatNumber(
        radiationFlux,
        "W/m²"
    );

    convectionResult.textContent = formatNumber(
        convectionFlux,
        "W/m²"
    );

    totalFluxResult.textContent = formatNumber(
        results.heat_flux,
        "W/m²"
    );

    totalRateResult.textContent = formatNumber(
        results.total_heat_rate,
        "W"
    );

    modelRadiationValue.textContent =
        `q″rad = ${formatNumber(
            radiationFlux,
            "W/m²"
        )}`;

    modelConvectionValue.textContent =
        `q″conv = ${formatNumber(
            convectionFlux,
            "W/m²"
        )}`;

    modelTotalValue.textContent =
        `Q̇ = ${formatNumber(
            results.total_heat_rate,
            "W"
        )}`;

    updateMechanismShares(
        radiationFlux,
        convectionFlux
    );

    updateMultipleLayerTable(
        results.glass_layers
    );

    updateMultipleGapTable(
        results.gaps
    );

    updateMultipleGlassColors(
        parameters,
        results.glass_layers
    );

    energyBalanceError.textContent =
        `${Number(
            results.energy_balance_error
        ).toExponential(3)} W/m²`;

    solverIterations.textContent =
        String(results.solver_iterations);

    modelStatusText.textContent =
        `${results.glass_layers.length} camlı model çözüldü`;
}


modelToggleButton.addEventListener(
    "click",
    () => {
        currentMode = currentMode === "single"
            ? "multiple"
            : "single";

        modelToggleButton.classList.toggle(
            "rotated"
        );

        updateModeInterface();
    }
);


glassCountInput.addEventListener(
    "change",
    () => {
        const numberOfGlasses = Number(
            glassCountInput.value
        );

        renderLayerInputs(numberOfGlasses);
        renderGlassSchematic(numberOfGlasses);
        clearResults();
    }
);


calculateButton.addEventListener(
    "click",
    async () => {
        clearResults();
        setLoadingState(true);

        try {
            const parameters =
                currentMode === "single"
                    ? buildSingleGlassPayload()
                    : buildMultipleGlassPayload();

            modelOvenTemperature.textContent =
                `${parameters.oven_temperature_c.toFixed(1)} °C`;

            modelRoomTemperature.textContent =
                `${parameters.room_temperature_c.toFixed(1)} °C`;

            const response = await fetch(
                "/calculate",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify(parameters),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error
                    || "Hesaplama başarısız oldu."
                );
            }

            if (data.mode === "single") {
                updateSingleGlassResults(
                    parameters,
                    data.results
                );

            } else {
                updateMultipleGlassResults(
                    parameters,
                    data.results
                );
            }

        } catch (error) {
            modelStatusText.textContent =
                "Hesaplama başarısız";

            alert(error.message);

        } finally {
            setLoadingState(false);
        }
    }
);


renderLayerInputs(
    Number(glassCountInput.value)
);

renderGlassSchematic(1);
updateModeInterface();