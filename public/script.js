//<------------------------- INICIO CÓDIGO JS COMPLETO ------------------------->
document.addEventListener('DOMContentLoaded', () => {
    // --- Helper para detectar Modo Oscuro ---
    const isDarkMode = () => document.body.classList.contains('dark-mode');

    // --- Helpers para obtener colores dinámicamente basados en el modo ---
    const getChartTextColor = () => isDarkMode() ? '#e0e0e0' : '#333';
    const getChartTitleColor = () => isDarkMode() ? '#ffffff' : '#2c3e50';
    const getChartGridColor = () => isDarkMode() ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    const getDatalabelColor = (value, chartType = 'bar') => {
         // Por defecto, usar el color de texto principal en modo oscuro
         if (isDarkMode()) return '#e0e0e0';
         // En modo claro, usar el color de texto principal (podría ajustarse más)
         return getChartTextColor();
    };
    const getFixedDatalabelColor = (darkModeColor = '#ffffff', lightModeColor = '#ffffff') => {
        // Color fijo para datalabels que deben contrastar con barras, independientemente del modo
        return isDarkMode() ? darkModeColor : lightModeColor;
    };


    // --- Registro de Plugins y Configuraciones por Defecto de Chart.js ---
    Chart.register(ChartDataLabels);
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.title.display = true; // Título global activado
    Chart.defaults.plugins.title.font.size = 16;
    // El color del título se establecerá dinámicamente por gráfico via opciones
    Chart.defaults.plugins.title.padding = { top: 10, bottom: 15 };
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.labels.padding = 15;
    // El color de la leyenda se establecerá dinámicamente por gráfico via opciones
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    Chart.defaults.plugins.tooltip.titleFont.size = 14;
    Chart.defaults.plugins.tooltip.bodyFont.size = 12;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.plugins.datalabels.display = false; // Deshabilitado globalmente, se activa por gráfico
    // El color de datalabels se establecerá dinámicamente por gráfico via opciones

    // --- Referencias a Elementos del DOM ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const darkModeBtn = document.getElementById('darkModeBtn');
    const narrativeElements = {
        kpi: document.getElementById('kpi-narrative'), // Mantenido por si acaso, aunque se limpia
        ventasAnuales: document.getElementById('ventasAnualesNarrative'),
        crecimientoAnual: document.getElementById('crecimientoAnualNarrative'),
        resumenFinanciero: document.getElementById('resumenFinancieroNarrative'),
        rentabilidadTable: document.getElementById('rentabilidadTableNarrative'),
        anualDetailTable: document.getElementById('anualDetailTableNarrative'),
        kpiTable: document.getElementById('kpiTableNarrative'),
        regionSales: document.getElementById('regionSalesNarrative'),
        sellerSales: document.getElementById('sellerSalesNarrative'),
        customerSales: document.getElementById('customerSalesNarrative'),
        productSales: document.getElementById('productSalesNarrative'),
        productPareto: document.getElementById('productParetoNarrative'),
        customerParetoNarrative: document.getElementById('customerParetoNarrative'),
        distribucionVentas: document.getElementById('distribucionVentasNarrative'),
        tendenciaAcumulada: document.getElementById('tendenciaAcumuladaNarrative'),
        // --- NUEVA REFERENCIA ---
        executiveSummaryNarrative: document.getElementById('executiveSummaryNarrative')
    };

    // --- Almacenamiento de instancias de gráficos ---
    let chartInstances = {};

    // --- Helpers de Formateo (Robustos con ?? 0) ---
    const formatCurrency = (value, digits = 0) => (value ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });
    const formatNumber = (value) => (value ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const formatPercent = (value, inputIsDecimal = true, decimals = 1) => { const numValue = (value ?? 0); const number = inputIsDecimal ? numValue * 100 : numValue; return number.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%'; };
    const getTrendEmoji = (value) => { const numValue = (value ?? 0); if (numValue > 0) return '📈'; if (numValue < 0) return '📉'; return '📊'; };
    const getMarginEmoji = (percentage) => { const numValue = (percentage ?? 0); if (numValue > 0.35) return '🤩'; if (numValue > 0.25) return '👍'; if (numValue > 0.10) return '😐'; return '😟'; };
    // Devuelve clase CSS para resaltar (definida en <style> o style.css)
    const getConditionalClass = (value, thresholdPositive = 0, thresholdNegative = 0) => { const numValue = (value ?? 0); if (numValue > thresholdPositive) return 'highlight-positive'; if (numValue < thresholdNegative) return 'highlight-negative'; return 'highlight-neutral'; };

    // --- Helpers de UI (Avanzados) ---
    const originalShowLoading = (show) => { // Mantenemos la función original para restaurar el estado
        if (loadingOverlay) {
            loadingOverlay.classList.toggle('hidden', !show);
            if (!show) {
                const msgEl = loadingOverlay.querySelector('.loading-message'); if (msgEl) msgEl.remove(); // Eliminar mensaje específico
                const spinner = loadingOverlay.querySelector('i'); if (spinner) spinner.style.display = 'inline-block'; // Mostrar spinner si existe
                // Intentar restaurar el texto por defecto
                const defaultTextNode = loadingOverlay.querySelector('div > br')?.nextSibling;
                if (defaultTextNode && defaultTextNode.nodeType === Node.TEXT_NODE) {
                    defaultTextNode.textContent = ' Cargando datos del dashboard...';
                } else if (spinner && spinner.parentNode && !spinner.parentNode.textContent.includes('Cargando datos')) {
                    // Si no se encontró el nodo de texto, intentar añadirlo después del spinner
                   try { // Usar try-catch por si el DOM cambia inesperadamente
                        const text = document.createTextNode(' Cargando datos del dashboard...');
                         spinner.parentNode.insertBefore(text, spinner.nextSibling);
                   } catch (e) { console.warn("No se pudo restaurar texto de carga:", e);}
                }
            }
        }
    };

    let showLoading = (show, message = null) => { // Función mejorada para mostrar mensajes personalizados
        if (loadingOverlay) {
            loadingOverlay.classList.toggle('hidden', !show);
            let msgEl = loadingOverlay.querySelector('.loading-message');
            const spinner = loadingOverlay.querySelector('i');
            const defaultText = loadingOverlay.querySelector('div > br')?.nextSibling; // Busca el texto después del <br>

            if (show) {
                // Ocultar el texto por defecto si vamos a mostrar un mensaje específico
                if (defaultText && defaultText.nodeType === Node.TEXT_NODE && message) {
                     defaultText.textContent = ''; // Limpiar texto por defecto
                 } else if (defaultText && defaultText.nodeType === Node.TEXT_NODE && !message) {
                     // Si no hay mensaje específico, asegurarse que el texto por defecto esté visible
                     defaultText.textContent = ' Cargando datos del dashboard...';
                 }

                if (spinner) spinner.style.display = 'inline-block'; // Asegurar que el spinner se vea

                if (message) { // Si hay un mensaje específico
                    if (!msgEl) { // Crear el elemento de mensaje si no existe
                        msgEl = document.createElement('div');
                        msgEl.className = 'loading-message';
                        // Insertar el mensaje después del spinner (o al final del div si no hay spinner)
                        if (spinner && spinner.parentNode) {
                            spinner.parentNode.insertBefore(msgEl, spinner.nextSibling);
                        } else if (loadingOverlay.firstElementChild) {
                            loadingOverlay.firstElementChild.appendChild(msgEl); // Añadir al primer hijo del overlay
                        } else {
                            loadingOverlay.appendChild(msgEl); // Como último recurso, añadir al overlay
                        }
                    }
                    msgEl.textContent = message; // Poner el texto del mensaje
                    msgEl.style.display = 'block'; // Asegurarse que sea visible
                } else { // Si no hay mensaje específico, ocultar el div de mensaje si existe
                    if (msgEl) msgEl.style.display = 'none';
                }

            } else {
                 originalShowLoading(false); // Al ocultar, usar la función original para restaurar estado por defecto
             }
        }
    };

    const showErrorState = (message) => {
        console.error("Dashboard Error State:", message);
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div class="error-message" style="color: red; padding: 20px; text-align: center; background-color: #ffebee; border: 1px solid #e57373; border-radius: 5px; margin: 20px;">
                    <h2><i class="fas fa-exclamation-triangle"></i> Error al Cargar el Dashboard</h2>
                    <p>${message || 'Ha ocurrido un error inesperado.'}</p>
                    <p>Por favor, verifica tu conexión a internet, la disponibilidad de los datos fuente o contacta al administrador del sistema si el problema persiste.</p>
                </div>`;
        }
        showLoading(false); // Ocultar overlay de carga
        if (exportPdfBtn) exportPdfBtn.disabled = true; // Deshabilitar exportación
        if (darkModeBtn) darkModeBtn.disabled = true; // Deshabilitar cambio de modo
    };

    // --- Destruir Gráficos Anteriores ---
    function destroyExistingCharts() {
        console.log("Destruyendo gráficos existentes...");
        let destroyedCount = 0;
        Object.keys(chartInstances).forEach(key => {
            const chart = chartInstances[key];
            if (chart && typeof chart.destroy === 'function') {
                try {
                    chart.destroy();
                    destroyedCount++;
                } catch (e) {
                    console.error(`Error destruyendo el gráfico '${key}':`, e);
                }
            }
        });
        chartInstances = {}; // Limpiar el objeto contenedor
        console.log(`${destroyedCount} gráficos destruidos.`);
    }

    // --- Función Principal de Carga e Inicialización (DOBLE FETCH) ---
    async function fetchAndInitializeDashboard() {
         showLoading(true, 'Cargando datos del dashboard...');
        let summaryData = null;
        let detailedSalesData = [];

        try {
            console.log("Iniciando carga de datos (Resumen y Detalle)...");
            const [summaryResponse, detailResponse] = await Promise.all([
                fetch('/api/datos-dashboard').catch(e => { console.error('Fetch /api/datos-dashboard falló:', e); return { ok: false, status: 0, statusText: `API Resumen fallido: ${e.message}` }; }),
                fetch('/api/dashboard-detail-data').catch(e => { console.error('Fetch /api/dashboard-detail-data falló:', e); return { ok: false, status: 0, statusText: `API Detalle fallido: ${e.message}` }; })
            ]);

            // Procesar respuesta de resumen
            if (!summaryResponse.ok) {
                 let errorMsg = `Error ${summaryResponse.status} al obtener datos resumen: ${summaryResponse.statusText}.`;
                 try { const errData = await summaryResponse.json(); errorMsg += ` Detalles: ${JSON.stringify(errData)}`; } catch (jsonError) { /* Ignorar si no es JSON */ }
                 throw new Error(errorMsg);
             }
             summaryData = await summaryResponse.json();
             if (!summaryData || typeof summaryData !== 'object' || Object.keys(summaryData).length === 0) {
                 throw new Error("No se recibieron datos resumen válidos o el objeto está vacío.");
             }
             console.log(`Datos Resumen recibidos: ${Object.keys(summaryData).length} claves.`);

            // Procesar respuesta de detalle (manejo más permisivo)
            if (!detailResponse.ok) {
                 console.warn(`Advertencia: Error ${detailResponse.status} al obtener datos detallados (${detailResponse.statusText}). Algunos gráficos y análisis podrían no estar disponibles.`);
                 detailedSalesData = []; // Continuar sin datos detallados
             } else {
                 try {
                     detailedSalesData = await detailResponse.json();
                     if (!Array.isArray(detailedSalesData)) {
                         console.warn("Los datos detallados recibidos no son un array. Se tratarán como vacíos.");
                         detailedSalesData = [];
                     } else {
                         console.log(`Datos Detallados recibidos: ${detailedSalesData.length} registros.`);
                     }
                 } catch (jsonError) {
                     console.warn(`Error al parsear JSON de datos detallados: ${jsonError.message}. Se tratarán como vacíos.`);
                     detailedSalesData = [];
                 }
             }

            // Si llegamos aquí con datos de resumen, inicializar UI
            initializeDashboardUI(summaryData, detailedSalesData);

        } catch (error) {
             console.error('Error fatal durante la carga y procesamiento de datos:', error);
             // Mostrar un mensaje más descriptivo si es posible
             const userMessage = error.message.includes("NetworkError") || error.message.includes("API Resumen fallido") || error.message.includes("failed to fetch")
                ? "No se pudo conectar con el servidor para obtener los datos principales. Verifica tu conexión o contacta al administrador."
                : `Ocurrió un error procesando los datos base: ${error.message}`;
             showErrorState(userMessage);
        } finally {
             // Asegurarse de ocultar el loading, incluso si hubo error no fatal
             showLoading(false);
             console.log("Proceso de carga de datos finalizado (con o sin éxito completo).");
         }
    }

    // --- Función que Inicializa/Renderiza la UI (USA AMBOS DATOS) ---
    function initializeDashboardUI(summaryData, detailedSalesData) {
        console.log("Inicializando y renderizando UI del dashboard...");
        if (!summaryData) {
            console.error("Intento de inicializar UI sin datos resumen. Abortando.");
            showErrorState("No se pudieron cargar los datos esenciales para mostrar el dashboard.");
            return;
        }

        destroyExistingCharts(); // Asegurar limpieza antes de renderizar

        // === Agregaciones y Cálculos ===
        console.time("Data Aggregation and Preparation");

        // Función robusta para agregar datos
        const aggregateDataByKey = (data, keyField, valueField = 'TOTAL', countField = null) => {
             if (!Array.isArray(data) || data.length === 0 || !keyField || !valueField) return [];

             const aggregation = data.reduce((acc, item) => {
                 // Validar que el item sea un objeto y tenga las claves necesarias
                 if (typeof item !== 'object' || item === null) return acc;

                 const key = item[keyField] !== undefined && item[keyField] !== null ? String(item[keyField]).trim() : 'Desconocido';
                 const value = typeof item[valueField] === 'number' && !isNaN(item[valueField]) ? item[valueField] : 0;
                 let quantity = 1; // Por defecto, cada item cuenta como 1 si no se especifica campo de cantidad

                 // Usar countField para sumar cantidades si se proporciona y es válido
                 if (countField && typeof item[countField] === 'number' && !isNaN(item[countField])) {
                     quantity = item[countField];
                 }

                 if (!acc[key]) {
                     acc[key] = { count: 0, totalValue: 0, totalQuantity: 0 };
                 }

                 acc[key].totalValue += value;
                 acc[key].totalQuantity += quantity; // Sumar la cantidad (sea 1 o del campo especificado)
                 acc[key].count++; // Contar cuántos registros originales contribuyen a esta clave

                 return acc;
             }, {});

             // Convertir el objeto agregado en un array y ordenar por valor descendente
             return Object.entries(aggregation)
                 .map(([k, { totalValue, count, totalQuantity }]) => ({
                     key: k,
                     value: totalValue,
                     count: count,          // Número de registros originales agrupados aquí
                     quantity: totalQuantity // Suma de cantidades (si se usó countField, sino es igual a count)
                 }))
                 .sort((a, b) => b.value - a.value); // Ordenar por valor total descendente
        };

        // Función para calcular Pareto
        const calculatePareto = (aggregatedData) => {
            if (!Array.isArray(aggregatedData) || aggregatedData.length === 0) {
                 return { labels: [], sales: [], cumulativePercent: [], category: [] };
             }
             // Asegurarse de que esté ordenado por valor descendente
             const sortedData = [...aggregatedData].sort((a, b) => b.value - a.value);
             const totalValue = sortedData.reduce((sum, item) => sum + (item.value || 0), 0);
             let cumulativeValue = 0;
             const paretoData = sortedData.map(item => {
                 cumulativeValue += (item.value || 0);
                 const cumulativePercent = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;
                 let category;
                 if (cumulativePercent <= 70) category = 'A'; // Vital
                 else if (cumulativePercent <= 90) category = 'B'; // Importante
                 else category = 'C'; // Trivial
                 return {
                     label: item.key,
                     sales: item.value || 0,
                     cumulativePercent: cumulativePercent,
                     category: category
                 };
             });

             return {
                 labels: paretoData.map(p => p.label),
                 sales: paretoData.map(p => p.sales),
                 cumulativePercent: paretoData.map(p => p.cumulativePercent),
                 category: paretoData.map(p => p.category) // Añadimos la categoría
             };
        };

        // Variables para datos agregados y resultados de Pareto
        let regionSales = [], sellerSales = [], customerSales = [], productSales = [];
        let productParetoResult = { labels: [], sales: [], cumulativePercent: [], category: [] };
        let customerParetoResult = { labels: [], sales: [], cumulativePercent: [], category: [] };
        let productParetoColors = [], customerParetoColors = [];
        // let avgSaleRegionData = []; // No se usa actualmente, comentar o quitar
        let topProductsQtyData = []; // Para el resumen ejecutivo

        // Definición de colores Pareto (podrían moverse a helpers si se usan en más sitios)
        const COLOR_PARETO_A = isDarkMode() ? 'rgba(46, 204, 113, 0.8)' : 'rgba(40, 167, 69, 0.8)'; // Verde
        const COLOR_PARETO_B = isDarkMode() ? 'rgba(241, 196, 15, 0.8)' : 'rgba(255, 193, 7, 0.8)'; // Amarillo
        const COLOR_PARETO_C = isDarkMode() ? 'rgba(231, 76, 60, 0.8)' : 'rgba(220, 53, 69, 0.8)'; // Rojo

        // Procesar datos detallados solo si existen y son válidos
        if (Array.isArray(detailedSalesData) && detailedSalesData.length > 0) {
            console.log("Agregando datos detallados...");
            regionSales = aggregateDataByKey(detailedSalesData, 'NOMBRE_REGION', 'TOTAL');
            sellerSales = aggregateDataByKey(detailedSalesData, 'NOMBRE_VENDEDOR', 'TOTAL');
            customerSales = aggregateDataByKey(detailedSalesData, 'NOMBRE_CLIENTE', 'TOTAL');
            productSales = aggregateDataByKey(detailedSalesData, 'NOMBRE_PRODUCTO', 'TOTAL');

            // Calcular Pareto para productos y clientes
            productParetoResult = calculatePareto(productSales);
            customerParetoResult = calculatePareto(customerSales);

            // Asignar colores basados en la categoría Pareto
            if (productParetoResult.category.length > 0) {
                 productParetoColors = productParetoResult.category.map(cat => cat === 'A' ? COLOR_PARETO_A : cat === 'B' ? COLOR_PARETO_B : COLOR_PARETO_C);
             }
             if (customerParetoResult.category.length > 0) {
                 customerParetoColors = customerParetoResult.category.map(cat => cat === 'A' ? COLOR_PARETO_A : cat === 'B' ? COLOR_PARETO_B : COLOR_PARETO_C);
             }

            // Calcular top productos por cantidad (usando aggregateDataByKey con 'CANTIDAD')
            // *** ¡¡¡VERIFICAR QUE EL CAMPO 'CANTIDAD' EXISTE Y ES CORRECTO EN detailedSalesData!!! ***
            const productQuantityAggregation = aggregateDataByKey(detailedSalesData, 'NOMBRE_PRODUCTO', 'CANTIDAD', 'CANTIDAD');
            // Ordenar por la suma de cantidades ('quantity' en el resultado de aggregateDataByKey)
            topProductsQtyData = productQuantityAggregation.sort((a, b) => b.quantity - a.quantity).slice(0, 5); // Top 5 por cantidad

        } else {
            console.warn("No hay datos detallados disponibles para agregaciones y análisis específicos (Región, Vendedor, Cliente, Producto, Pareto).");
            // Asegurar que las variables estén vacías para que las narrativas muestren mensaje adecuado
            regionSales = []; sellerSales = []; customerSales = []; productSales = [];
            productParetoResult = { labels: [], sales: [], cumulativePercent: [], category: [] };
            customerParetoResult = { labels: [], sales: [], cumulativePercent: [], category: [] };
            topProductsQtyData = [];
        }
        console.timeEnd("Data Aggregation and Preparation");

        // === Renderizado de Componentes y Narrativas ===
        console.log("Renderizando componentes de la UI...");
        try {
            // 1. Renderizar componentes que dependen SOLO de summaryData (Siempre disponibles)
            renderKPIs(summaryData);
            renderAnnualCharts(summaryData);
            generateAnnualNarratives(summaryData, narrativeElements.ventasAnuales, narrativeElements.crecimientoAnual);
            renderProfitability(summaryData);
            generateProfitabilityNarratives(summaryData, narrativeElements.resumenFinanciero, narrativeElements.rentabilidadTable);
            renderDetailTables(summaryData);
            generateDetailTableNarratives(summaryData, narrativeElements.anualDetailTable, narrativeElements.kpiTable);
            renderOtherAnnualCharts(summaryData);
            generateOtherAnnualNarratives(summaryData, narrativeElements.distribucionVentas, narrativeElements.tendenciaAcumulada);

            // 2. Renderizar componentes que dependen de detailedSalesData (Condicional)
            const detailedSections = [ // Selectores de las SECCIONES que contienen estos gráficos/tablas
                'section[aria-labelledby="geo-seller-heading"]',
                'section[aria-labelledby="customer-product-heading"]',
                'section[aria-labelledby="pareto-heading"]',
                'section[aria-labelledby="customer-pareto-heading"]'
            ];

            if (detailedSalesData && detailedSalesData.length > 0) {
                 // Mostrar las secciones si hay datos
                 detailedSections.forEach(selector => {
                    const section = document.querySelector(selector);
                    if (section) section.classList.remove('hidden');
                    else console.warn(`Sección no encontrada: ${selector}`);
                 });

                // Renderizar gráficos y generar narrativas correspondientes
                renderGeoSellerCharts(regionSales, sellerSales.slice(0, 10)); // Top 10 vendedores
                generateGeoSellerNarratives(regionSales, sellerSales.slice(0, 10), detailedSalesData.length, narrativeElements.regionSales, narrativeElements.sellerSales);

                renderCustomerProductCharts(customerSales.slice(0, 10), productSales.slice(0, 10)); // Top 10 clientes y productos
                generateCustomerProductNarratives(customerSales.slice(0, 10), productSales.slice(0, 10), customerSales.length, productSales.length, narrativeElements.customerSales, narrativeElements.productSales);

                renderParetoChart(productParetoResult, productParetoColors);
                generateParetoNarrative(productParetoResult, productSales, narrativeElements.productPareto);

                renderCustomerParetoChart(customerParetoResult, customerParetoColors);
                generateCustomerParetoNarrative(customerParetoResult, customerSales, narrativeElements.customerParetoNarrative);

            } else {
                // Ocultar las secciones si NO hay datos detallados
                detailedSections.forEach(selector => {
                    const section = document.querySelector(selector);
                     if (section) section.classList.add('hidden');
                     // No es necesario un warning aquí si los datos no llegaron
                 });
                 // Actualizar narrativas para indicar falta de datos (opcional, podría hacerse en generate... si reciben datos vacíos)
                 narrativeElements.regionSales.textContent = "Análisis por región no disponible por falta de datos detallados.";
                 narrativeElements.sellerSales.textContent = "Análisis por vendedor no disponible por falta de datos detallados.";
                 narrativeElements.customerSales.textContent = "Análisis por cliente no disponible por falta de datos detallados.";
                 narrativeElements.productSales.textContent = "Análisis por producto no disponible por falta de datos detallados.";
                 narrativeElements.productPareto.textContent = "Análisis Pareto de Productos no disponible por falta de datos detallados.";
                 if (narrativeElements.customerParetoNarrative) narrativeElements.customerParetoNarrative.textContent = "Análisis Pareto de Clientes no disponible por falta de datos detallados.";
            }

            // 3. Generar Resumen Ejecutivo (usa ambos tipos de datos, maneja internos si faltan detalles)
             // Asegurarse que el contenedor del resumen esté visible
             const summarySection = document.querySelector('.executive-summary-section');
             if(summarySection) summarySection.classList.remove('hidden');

             generateExecutiveSummary(
                summaryData,
                regionSales,        // Puede ser array vacío
                customerParetoResult, // Puede tener arrays vacíos dentro
                productParetoResult,  // Puede tener arrays vacíos dentro
                topProductsQtyData, // Puede ser array vacío
                narrativeElements.executiveSummaryNarrative // Elemento donde se renderizará
            );
            // Limpiar narrativa original de KPI si ya no se usa (el resumen ejecutivo la reemplaza)
            if (narrativeElements.kpi) narrativeElements.kpi.innerHTML = '';


            // Habilitar botón de exportación si todo fue bien
            if (exportPdfBtn) exportPdfBtn.disabled = false;

        } catch (renderError) {
            console.error("Error crítico durante el renderizado de la UI:", renderError);
            showErrorState(`Error al mostrar los componentes del dashboard: ${renderError.message}. Algunos elementos podrían no funcionar correctamente.`);
            if (exportPdfBtn) exportPdfBtn.disabled = true; // Deshabilitar si el renderizado falla
        } finally {
            console.log("Renderizado de la UI finalizado.");
            // Opcional: forzar ocultar loading aquí si aún está visible por alguna razón
             showLoading(false);
        }
    }


    // =========================================================================
    // === FUNCIONES DE RENDERIZADO DE COMPONENTES (Completas y Originales con adaptación de color) ===
    // =========================================================================

    function renderKPIs(data) {
        if (!data) { console.warn("renderKPIs: Faltan datos."); return; }
        // Mapeo de IDs de elementos KPI a datos y formateadores
        const kpiMapping = {
            'kpiIngresoTotal': {
                value: data.Ingreso_Total,
                comparison: data.Diferencia_2025_vs_2024, // Asumiendo que este es el dato de comparación relevante
                format: formatCurrency,
                compFormat: (v) => `${(v ?? 0) >= 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(v ?? 0))} vs Año Anterior`, // Texto más claro
                compClass: (v) => getConditionalClass(v).replace('highlight-', '') // Clase basada en positivo/negativo
            },
            'kpiMargenTotal': {
                value: data.Margen_Total,
                comparison: data.Porcentaje_Margen, // Mostrar el % de margen como "comparación" o contexto
                format: formatCurrency,
                compFormat: (v) => `Margen: ${formatPercent(v)}`, // Mostrar el %
                compClass: (v) => getConditionalClass(v, 0.25, 0.10).replace('highlight-', '') // Usar clase basada en margen %
            },
            'kpiMargenPorc': {
                value: data.Porcentaje_Margen,
                indicator: data.Porcentaje_Margen, // Usar el mismo valor para el emoji
                format: formatPercent,
                indiFormat: getMarginEmoji, // Emoji basado en el %
                indiClass: (v) => getConditionalClass(v, 0.25, 0.10).replace('highlight-', '') // Clase basada en el %
            },
            'kpiCantidad': {
                value: data.Cantidad_Total,
                format: formatNumber
                // Sin comparación o indicador específico aquí
            }
        };

        Object.entries(kpiMapping).forEach(([id, config]) => {
            const card = document.getElementById(id);
            if (card) {
                const valueEl = card.querySelector('.kpi-value');
                const comparisonEl = card.querySelector('.kpi-comparison');
                const indicatorEl = card.querySelector('.kpi-indicator');

                if (valueEl) {
                    valueEl.textContent = config.format ? config.format(config.value) : (config.value ?? '--');
                }

                if (comparisonEl) {
                    if (config.comparison !== undefined && config.comparison !== null) {
                        comparisonEl.textContent = config.compFormat ? config.compFormat(config.comparison) : String(config.comparison ?? '--');
                        // Aplicar clase condicional si está definida
                        comparisonEl.className = `kpi-comparison ${config.compClass ? config.compClass(config.comparison) : ''}`.trim();
                    } else {
                        comparisonEl.textContent = ''; // Limpiar si no hay dato
                        comparisonEl.className = 'kpi-comparison'; // Resetear clase
                    }
                }

                if (indicatorEl) {
                    if (config.indicator !== undefined && config.indicator !== null) {
                        indicatorEl.textContent = config.indiFormat ? config.indiFormat(config.indicator) : String(config.indicator ?? '--');
                         // Aplicar clase condicional si está definida
                        indicatorEl.className = `kpi-indicator ${config.indiClass ? config.indiClass(config.indicator) : ''}`.trim();
                    } else {
                        indicatorEl.textContent = ''; // Limpiar si no hay dato
                        indicatorEl.className = 'kpi-indicator'; // Resetear clase
                    }
                }
            } else {
                console.warn(`KPI Card con ID '${id}' no encontrado en el DOM.`);
            }
        });
    }

    function renderAnnualCharts(data) {
        if (!data) { console.warn("renderAnnualCharts: Faltan datos."); return; }
        const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
        const salesData = years.map(year => data[`Venta_${year}`] ?? 0);
        // Asegurarse que los valores de crecimiento sean números o null/undefined
        const growthValues = [
            data.Crecimiento_2020_vs_2019, data.Crecimiento_2021_vs_2020, data.Crecimiento_2022_vs_2021,
            data.Crecimiento_2023_vs_2022, data.Crecimiento_2024_vs_2023, data.Crecimiento_2025_vs_2024
        ].map(v => (typeof v === 'number' ? v : null)); // Convertir a null si no es número

        const growthPeriods = ['20 vs 19', '21 vs 20', '22 vs 21', '23 vs 22', '24 vs 23', '25 vs 24'];

        // Colores dinámicos para barras de ventas
        const barBackgroundColor = isDarkMode() ? 'rgba(82, 190, 128, 0.7)' : 'rgba(52, 152, 219, 0.7)';
        const barBorderColor = isDarkMode() ? 'rgba(82, 190, 128, 1)' : 'rgba(41, 128, 185, 1)';

        // Colores dinámicos y condicionales para barras de crecimiento
        const growthColors = growthValues.map(v =>
             v === null ? 'rgba(128, 128, 128, 0.5)' // Gris para datos faltantes
             : v >= 0 ? (isDarkMode() ? 'rgba(46, 204, 113, 0.8)' : 'rgba(40, 167, 69, 0.8)') // Verde para positivo
             : (isDarkMode() ? 'rgba(231, 76, 60, 0.8)' : 'rgba(220, 53, 69, 0.8)') // Rojo para negativo
        );
        const growthBorderColors = growthValues.map(v =>
             v === null ? 'rgba(128, 128, 128, 0.8)'
             : v >= 0 ? (isDarkMode() ? 'rgba(46, 204, 113, 1)' : 'rgba(39, 174, 96, 1)')
             : (isDarkMode() ? 'rgba(231, 76, 60, 1)' : 'rgba(192, 57, 43, 1)')
        );

        const ctxSales = document.getElementById('ventasAnualesChart')?.getContext('2d');
        if (ctxSales) {
            if (chartInstances.ventasAnuales) { try { chartInstances.ventasAnuales.destroy(); } catch(e){ console.error("Error destruyendo chart ventasAnuales:", e); } }
            chartInstances.ventasAnuales = new Chart(ctxSales, {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [{
                        label: 'Ventas Anuales ($)',
                        data: salesData,
                        backgroundColor: barBackgroundColor,
                        borderColor: barBorderColor,
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { text: 'Ventas Anuales ($)', color: getChartTitleColor(), display: true }, // Título específico del gráfico
                        legend: { display: true, labels: { color: getChartTextColor() } }, // Mostrar leyenda
                        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'end',
                            formatter: (v) => v !== 0 ? formatCurrency(v / 1000000, 1) + 'M' : '', // No mostrar si es 0
                            font: { size: 10, weight: 'bold' },
                            color: getDatalabelColor(null, 'bar') // Color dinámico
                        }
                    },
                    scales: {
                        x: { ticks: { color: getChartTextColor() }, grid: { color: getChartGridColor() } },
                        y: {
                             beginAtZero: false, // Empezar cerca del valor mínimo para mejor visualización
                             ticks: { callback: v => formatCurrency(v / 1000000, 0) + 'M', color: getChartTextColor() },
                             grid: { color: getChartGridColor() }
                        }
                    }
                }
            });
        } else { console.error("Canvas 'ventasAnualesChart' no encontrado."); }

        const ctxGrowth = document.getElementById('crecimientoAnualChart')?.getContext('2d');
        if (ctxGrowth) {
             if (chartInstances.crecimientoAnual) { try { chartInstances.crecimientoAnual.destroy(); } catch(e){ console.error("Error destruyendo chart crecimientoAnual:", e); } }
            chartInstances.crecimientoAnual = new Chart(ctxGrowth, {
                type: 'bar',
                data: {
                    labels: growthPeriods,
                    datasets: [{
                        label: 'Crecimiento vs Año Anterior (%)',
                        data: growthValues, // Puede contener nulls
                        backgroundColor: growthColors,
                        borderColor: growthBorderColors,
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { text: 'Crecimiento Anual (%)', color: getChartTitleColor(), display: true },
                        legend: { display: false }, // Ocultar leyenda para este gráfico
                        tooltip: { callbacks: { label: ctx => ` Crec.: ${ctx.parsed.y !== null ? formatPercent(ctx.parsed.y, false, 1) : 'N/A'}` } },
                        datalabels: {
                            display: true,
                            anchor: 'center', // Centrado para mejor lectura sobre colores
                            align: 'center',
                            formatter: (v) => v !== null ? formatPercent(v, false, 1) : '', // Mostrar solo si hay valor
                            color: getFixedDatalabelColor('#ffffff', '#ffffff'), // Blanco fijo para contraste con barras verdes/rojas
                            font: { weight: 'bold', size: 10 }
                        }
                    },
                    scales: {
                        x: { ticks: { color: getChartTextColor() }, grid: { color: getChartGridColor() } },
                        y: {
                            ticks: { callback: v => formatPercent(v, false, 0), color: getChartTextColor() }, // Formato %
                            grid: { color: getChartGridColor() }
                        }
                    }
                }
            });
        } else { console.error("Canvas 'crecimientoAnualChart' no encontrado."); }
    }

    function renderProfitability(data) {
        if (!data) { console.warn("renderProfitability: Faltan datos."); return; }
        const financialLabels = ['Ingreso Total', 'Costo Total', 'Margen Total'];
        const financialValues = [data.Ingreso_Total ?? 0, data.Costo_Total ?? 0, data.Margen_Total ?? 0];

        // Colores específicos para este gráfico
        const financialColors = [
             isDarkMode() ? 'rgba(82, 190, 128, 0.7)' : 'rgba(52, 152, 219, 0.7)', // Ingreso
             isDarkMode() ? 'rgba(240, 178, 122, 0.7)' : 'rgba(230, 126, 34, 0.7)', // Costo
             isDarkMode() ? 'rgba(46, 204, 113, 0.7)' : 'rgba(40, 167, 69, 0.7)'  // Margen
        ];
        const borderColors = [
             isDarkMode() ? 'rgba(82, 190, 128, 1)' : 'rgba(41, 128, 185, 1)',
             isDarkMode() ? 'rgba(240, 178, 122, 1)' : 'rgba(192, 57, 43, 1)', // Cambiado a rojo más oscuro en light
             isDarkMode() ? 'rgba(46, 204, 113, 1)' : 'rgba(39, 174, 96, 1)'
        ];

        const ctxFinancial = document.getElementById('resumenFinancieroChart')?.getContext('2d');
        if (ctxFinancial) {
            if (chartInstances.resumenFinanciero) { try { chartInstances.resumenFinanciero.destroy(); } catch(e){ console.error("Error destruyendo chart resumenFinanciero:", e); } }
            chartInstances.resumenFinanciero = new Chart(ctxFinancial, {
                type: 'bar',
                data: {
                    labels: financialLabels,
                    datasets: [{
                        label: 'Monto ($)', // Etiqueta para tooltips y leyenda (si se muestra)
                        data: financialValues,
                        backgroundColor: financialColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                        borderRadius: 5
                    }]
                },
                options: {
                    indexAxis: 'y', // Barras horizontales
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: false }, // Título provisto por H3 en HTML
                        legend: { display: false }, // Leyenda no necesaria aquí
                        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed.x)}` } }, // Tooltip para barras horizontales (usa .x)
                        datalabels: {
                            display: true,
                            anchor: 'end', // Al final de la barra
                            align: 'right', // A la derecha (fuera de la barra si hay espacio)
                            formatter: v => formatCurrency(v), // Formato de moneda
                            font: { weight: 'bold' },
                            color: getDatalabelColor(null, 'bar'), // Color dinámico
                            padding: { left: 10 } // Pequeño espacio a la izquierda del texto
                        }
                    },
                    scales: {
                        x: { // Eje horizontal (valores)
                            beginAtZero: true,
                            ticks: { callback: v => formatCurrency(v / 1000000, 0) + 'M', color: getChartTextColor() }, // Formato Millones
                            grid: { color: getChartGridColor() }
                         },
                        y: { // Eje vertical (categorías)
                            ticks: { color: getChartTextColor() },
                            grid: { display: false } // Ocultar rejilla vertical
                        }
                    }
                }
            });
        } else { console.error("Canvas 'resumenFinancieroChart' no encontrado."); }

        // --- Renderizado de la Tabla de Rentabilidad ---
        const rentabilidadTableBody = document.getElementById('rentabilidadTableBody');
        if (rentabilidadTableBody) {
            rentabilidadTableBody.innerHTML = ''; // Limpiar tabla anterior
            const ingresoTotalRent = data.Ingreso_Total ?? 0;
            const costoTotalRent = data.Costo_Total ?? 0;
            // Calcular porcentaje de costo sobre ingreso (manejar división por cero)
            const costoPorcRent = ingresoTotalRent !== 0 ? (costoTotalRent / ingresoTotalRent) : 0;
            // Usar el porcentaje de margen directamente de los datos si existe, sino calcularlo
            const margenPorcRent = data.Porcentaje_Margen ?? (ingresoTotalRent !== 0 ? ((ingresoTotalRent - costoTotalRent) / ingresoTotalRent) : 0);

            // Items para la tabla
            const rentabilidadItems = [
                { label: 'Costo s/ Ingreso', value: costoPorcRent, emoji: costoPorcRent < 0.70 ? '👍' : (costoPorcRent < 0.85 ? '😐' : '😟') }, // Emoji basado en % costo
                { label: 'Margen s/ Ingreso', value: margenPorcRent, emoji: getMarginEmoji(margenPorcRent) } // Emoji basado en % margen
            ];

            // Crear filas de la tabla
            rentabilidadItems.forEach(item => {
                const row = rentabilidadTableBody.insertRow();
                row.insertCell().textContent = item.label; // Columna 1: Etiqueta
                const valueCell = row.insertCell();
                valueCell.textContent = formatPercent(item.value); // Columna 2: Valor formateado como %
                valueCell.classList.add('text-right'); // Alinear a la derecha
                 // Aplicar clase condicional al valor de margen
                 if (item.label === 'Margen s/ Ingreso') {
                    valueCell.classList.add(getConditionalClass(item.value, 0.25, 0.10).replace('highlight-', ''));
                 }
                const emojiCell = row.insertCell();
                emojiCell.textContent = item.emoji; // Columna 3: Indicador emoji
                emojiCell.classList.add('indicator-cell', 'text-center'); // Clases para centrar y estilo
            });
        } else { console.error("Elemento 'rentabilidadTableBody' no encontrado."); }
    }

    function renderDetailTables(data) {
        if (!data) { console.warn("renderDetailTables: Faltan datos."); return; }

        // --- Tabla de Detalle Anual ---
        const anualDetailTableBody = document.getElementById('anualDetailTableBody');
        if (anualDetailTableBody) {
             anualDetailTableBody.innerHTML = ''; // Limpiar tabla anterior
             const years = ['2019','2020', '2021', '2022', '2023', '2024', '2025'];
             // Mapear datos anuales, buscando los campos correctos
             const anualData = years.map(yearStr => {
                 const year = parseInt(yearStr);
                 const sales = data[`Venta_${yearStr}`] ?? 0;
                 let diff = null;
                 let growth = null;
                 const prevYearStr = String(year - 1);
                 // Buscar diferencia y crecimiento vs año anterior
                 if (data.hasOwnProperty(`Diferencia_${yearStr}_vs_${prevYearStr}`)) {
                     diff = data[`Diferencia_${yearStr}_vs_${prevYearStr}`];
                 }
                 if (data.hasOwnProperty(`Crecimiento_${yearStr}_vs_${prevYearStr}`)) {
                     growth = data[`Crecimiento_${yearStr}_vs_${prevYearStr}`];
                 }
                 // Asegurar que diff y growth sean números o null
                 diff = (typeof diff === 'number' && !isNaN(diff)) ? diff : null;
                 growth = (typeof growth === 'number' && !isNaN(growth)) ? growth : null;

                 return { year, sales, diff, growth };
             }).sort((a, b) => a.year - b.year); // Ordenar por año ascendente

             // Crear filas de la tabla
             anualData.forEach(item => {
                 const row = anualDetailTableBody.insertRow();
                 row.insertCell().textContent = item.year; // Año

                 // Ventas
                 const salesCell = row.insertCell();
                 salesCell.textContent = formatCurrency(item.sales);
                 salesCell.classList.add('text-right');

                 // Diferencia vs Año Anterior
                 const diffCell = row.insertCell();
                 diffCell.textContent = item.diff !== null ? formatCurrency(item.diff) : '-'; // Mostrar '-' si es null
                 diffCell.className = `text-right ${item.diff !== null ? getConditionalClass(item.diff).replace('highlight-', '') : 'neutral'}`; // Clase condicional

                 // Crecimiento % vs Año Anterior
                 const growthCell = row.insertCell();
                 growthCell.textContent = item.growth !== null ? formatPercent(item.growth, false) : '-'; // Formato % (input NO es decimal), '-' si es null
                 growthCell.className = `text-right ${item.growth !== null ? getConditionalClass(item.growth).replace('highlight-', '') : 'neutral'}`; // Clase condicional

                 // Indicador de Tendencia
                 const trendCell = row.insertCell();
                 trendCell.textContent = item.growth !== null ? getTrendEmoji(item.growth) : '-'; // Emoji de tendencia, '-' si es null
                 trendCell.classList.add('indicator-cell', 'text-center');
             });
        } else { console.error("Elemento 'anualDetailTableBody' no encontrado.");}

        // --- Tabla de KPIs Consolidados ---
        const kpiTableBody = document.getElementById('kpiTableBody');
        if (kpiTableBody) {
            kpiTableBody.innerHTML = ''; // Limpiar tabla anterior
            const margenPctKPI = data.Porcentaje_Margen ?? 0; // Valor numérico para lógica condicional

            // Items para la tabla KPI
            const kpiItems = [
                { label: 'Total Registros', value: formatNumber(data.Total_Registros), status: '-' },
                { label: 'Ingreso Total', value: formatCurrency(data.Ingreso_Total), status: '-' },
                { label: 'Cantidad Total', value: formatNumber(data.Cantidad_Total), status: '-' },
                { label: 'Costo Total', value: formatCurrency(data.Costo_Total), status: '-' },
                { label: 'Margen Total', value: formatCurrency(data.Margen_Total), status: '-' },
                { label: 'Margen Porcentual', value: formatPercent(margenPctKPI), status: getMarginEmoji(margenPctKPI), rawValue: margenPctKPI } // Incluir valor raw para clase
            ];

            // Crear filas de la tabla
            kpiItems.forEach(item => {
                const row = kpiTableBody.insertRow();
                row.insertCell().textContent = item.label; // Etiqueta

                const valueCell = row.insertCell();
                valueCell.textContent = item.value; // Valor formateado
                valueCell.classList.add('text-right');

                const statusCell = row.insertCell();
                statusCell.textContent = item.status; // Indicador/Status
                statusCell.classList.add('indicator-cell', 'text-center');

                // Aplicar clase condicional SOLO a la celda del valor de Margen Porcentual
                if (item.label === 'Margen Porcentual' && item.rawValue !== undefined) {
                    valueCell.classList.add(getConditionalClass(item.rawValue, 0.25, 0.10).replace('highlight-', ''));
                }
            });
        } else { console.error("Elemento 'kpiTableBody' no encontrado."); }
    }

     function renderOtherAnnualCharts(data) {
        if (!data) { console.warn("renderOtherAnnualCharts: Faltan datos."); return; }
        const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
        const salesData = years.map(year => data[`Venta_${year}`] ?? 0);
        const totalSales = salesData.reduce((a, b) => a + b, 0);
        const growthValues = [
             null, // No hay crecimiento para el primer año (2019 vs 2018)
             data.Crecimiento_2020_vs_2019, data.Crecimiento_2021_vs_2020,
             data.Crecimiento_2022_vs_2021, data.Crecimiento_2023_vs_2022,
             data.Crecimiento_2024_vs_2023, data.Crecimiento_2025_vs_2024
        ].map(v => (typeof v === 'number' ? v : null)); // Asegurar nulls si no hay dato

        // --- Gráfico de Distribución de Ventas (Dona) ---
        const ctxDistribucion = document.getElementById('distribucionVentasChart')?.getContext('2d');
         if (ctxDistribucion) {
             if (chartInstances.distribucionVentas) { try { chartInstances.distribucionVentas.destroy(); } catch(e){ console.error("Error destruyendo chart distribucionVentas:", e); } }
             // Colores definidos para la dona (pueden ser más si hay más años)
             const backgroundColors = [
                 '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e', '#e67e22'
             ];
             // Solo renderizar si hay ventas totales > 0
             if (totalSales > 0) {
                 chartInstances.distribucionVentas = new Chart(ctxDistribucion, {
                     type: 'doughnut',
                     data: {
                         labels: years,
                         datasets: [{
                             data: salesData,
                             backgroundColor: backgroundColors.slice(0, years.length), // Usar solo los colores necesarios
                             borderColor: isDarkMode() ? '#2c3e50' : '#ffffff', // Borde para separar segmentos
                             borderWidth: 2
                         }]
                     },
                     options: {
                         responsive: true,
                         maintainAspectRatio: false,
                         plugins: {
                             title: { display: false }, // Título en H3
                             legend: {
                                 position: 'right', // Leyenda a la derecha
                                 labels: { color: getChartTextColor() }
                             },
                             tooltip: {
                                 callbacks: {
                                      // Mostrar: Año: Valor ($) (Porcentaje%)
                                     label: ctx => {
                                          const value = ctx.parsed || 0;
                                          const percentage = totalSales > 0 ? (value / totalSales) : 0;
                                          return ` ${ctx.label}: ${formatCurrency(value)} (${formatPercent(percentage, true, 1)})`;
                                     }
                                 }
                             },
                             datalabels: {
                                 display: true,
                                 formatter: (value, ctx) => {
                                     // Mostrar porcentaje solo si es significativo (ej. > 3%)
                                     const percentage = totalSales > 0 ? (value / totalSales) : 0;
                                     return percentage > 0.03 ? formatPercent(percentage, true, 0) : '';
                                 },
                                 color: getFixedDatalabelColor('#ffffff', '#ffffff'), // Texto blanco para contraste
                                 font: { weight: 'bold' }
                             }
                         }
                     }
                 });
             } else {
                  // Mostrar mensaje si no hay datos o total es 0
                  ctxDistribucion.clearRect(0, 0, ctxDistribucion.canvas.width, ctxDistribucion.canvas.height);
                  ctxDistribucion.save();
                  ctxDistribucion.fillStyle = getChartTextColor(); // Color de texto del modo actual
                  ctxDistribucion.textAlign = 'center';
                  ctxDistribucion.font = "14px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
                  ctxDistribucion.fillText("Datos no disponibles", ctxDistribucion.canvas.width / 2, ctxDistribucion.canvas.height / 2);
                  ctxDistribucion.restore();
             }
         } else { console.error("Canvas 'distribucionVentasChart' no encontrado."); }

         // --- Gráfico de Tendencia Acumulada (Barras + Línea) ---
         const ctxTendencia = document.getElementById('tendenciaAcumuladaChart')?.getContext('2d');
         if (ctxTendencia) {
              if (chartInstances.tendenciaAcumulada) { try { chartInstances.tendenciaAcumulada.destroy(); } catch(e){ console.error("Error destruyendo chart tendenciaAcumulada:", e); } }
              chartInstances.tendenciaAcumulada = new Chart(ctxTendencia, {
                  type: 'bar', // Tipo base es barra
                  data: {
                      labels: years,
                      datasets: [
                          {
                              type: 'bar', // Dataset de barras para ventas
                              label: 'Ventas ($)',
                              data: salesData,
                              backgroundColor: isDarkMode() ? 'rgba(93, 173, 226, 0.7)' : 'rgba(52, 152, 219, 0.7)',
                              borderColor: isDarkMode() ? 'rgba(93, 173, 226, 1)' : 'rgba(41, 128, 185, 1)',
                              borderWidth: 1,
                              yAxisID: 'ySales', // Asociar al eje Y izquierdo
                              order: 2 // Dibujar barras detrás de la línea
                          },
                          {
                              type: 'line', // Dataset de línea para crecimiento
                              label: 'Crecimiento (%)',
                              data: growthValues, // Puede contener nulls
                              borderColor: isDarkMode() ? '#e74c3c' : '#c0392b', // Color rojo/oscuro para la línea
                              backgroundColor: 'transparent', // Sin relleno bajo la línea
                              fill: false,
                              yAxisID: 'yGrowth', // Asociar al eje Y derecho
                              order: 1, // Dibujar línea encima de las barras
                              tension: 0.1, // Suavizar ligeramente la línea
                              pointRadius: 3, // Tamaño de los puntos
                              pointBackgroundColor: isDarkMode() ? '#e74c3c' : '#c0392b', // Color de los puntos
                              spanGaps: false // No conectar puntos si hay un null entre ellos
                          }
                      ]
                  },
                  options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: {
                          mode: 'index', // Mostrar tooltips para ambos datasets al pasar sobre un índice X
                          intersect: false // No requerir pasar exactamente sobre el punto/barra
                      },
                      plugins: {
                          title: { display: false }, // Título en H3
                          legend: { labels: { color: getChartTextColor() } },
                          tooltip: {
                              callbacks: {
                                   // Mostrar tooltip formateado para ventas o crecimiento
                                  label: ctx => {
                                      const label = ctx.dataset.label || '';
                                      const value = ctx.parsed.y;
                                      if (value === null) return `${label}: N/A`; // Mostrar N/A si el dato es null
                                      if (ctx.dataset.yAxisID === 'yGrowth') {
                                          return `${label}: ${formatPercent(value, false, 1)}`; // Formato % para crecimiento
                                      } else {
                                          return `${label}: ${formatCurrency(value)}`; // Formato moneda para ventas
                                      }
                                  }
                              }
                          },
                          datalabels: { display: false } // Deshabilitar datalabels para este gráfico combinado
                      },
                      scales: {
                          x: {
                              ticks:{color: getChartTextColor()},
                              grid: { display: false } // Ocultar rejilla X
                          },
                          ySales: { // Eje Y izquierdo para Ventas
                              type: 'linear',
                              position: 'left',
                              beginAtZero: false, // Empezar cerca del mínimo para ventas
                              title: {
                                  display: true,
                                  text: 'Ventas ($)',
                                  color: getChartTextColor()
                              },
                              ticks: {
                                  callback: v => formatCurrency(v / 1000000, 1) + 'M', // Formato Millones
                                  color: getChartTextColor()
                              },
                              grid: { color: getChartGridColor() } // Rejilla principal
                          },
                          yGrowth: { // Eje Y derecho para Crecimiento
                              type: 'linear',
                              position: 'right',
                              title: {
                                  display: true,
                                  text: 'Crecimiento (%)',
                                  color: getChartTextColor()
                              },
                              ticks: {
                                  callback: v => formatPercent(v, false, 0), // Formato %
                                  color: getChartTextColor()
                              },
                              grid: { drawOnChartArea: false } // No dibujar rejilla para este eje
                          }
                      }
                  }
              });
          } else { console.error("Canvas 'tendenciaAcumuladaChart' no encontrado."); }
     }

     function renderGeoSellerCharts(regionData, topSellerData) {
         if (!regionData) regionData = [];
         if (!topSellerData) topSellerData = [];

         // --- Gráfico de Ventas por Región (Barras Verticales) ---
          const ctxRegion = document.getElementById('regionSalesChart')?.getContext('2d');
         if (ctxRegion) {
              if (chartInstances.regionSales) { try { chartInstances.regionSales.destroy(); } catch(e){ console.error("Error destruyendo chart regionSales:", e); } }
              const labels = regionData.map(item => item.key);
              const values = regionData.map(item => item.value);

              chartInstances.regionSales = new Chart(ctxRegion, {
                  type: 'bar',
                  data: {
                      labels: labels,
                      datasets: [{
                          label: 'Ventas por Región ($)',
                          data: values,
                          backgroundColor: isDarkMode() ? 'rgba(93, 173, 226, 0.7)' : 'rgba(54, 162, 235, 0.7)', // Azul
                          borderColor: isDarkMode() ? 'rgba(93, 173, 226, 1)' : 'rgba(54, 162, 235, 1)',
                          borderWidth: 1,
                          borderRadius: 4
                      }]
                  },
                  options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                          title: { display: false /* Título en H3 */ },
                          legend: { display: true, labels: { color: getChartTextColor() } },
                          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed.y)}` } },
                          datalabels: {
                              display: true,
                              anchor: 'end',
                              align: 'end',
                              formatter: (v) => v !== 0 ? formatCurrency(v / 1000, 0) + 'K' : '', // Formato Miles (K), ocultar si 0
                              font: { size: 9, weight: 'bold' },
                              color: getDatalabelColor(null, 'bar') // Color dinámico
                          }
                      },
                      scales: {
                          x: { ticks: { color: getChartTextColor() }, grid: { color: getChartGridColor() } },
                          y: {
                              beginAtZero: true,
                              ticks: { callback: v => formatCurrency(v / 1000000, 1) + 'M', color: getChartTextColor() }, // Formato Millones (M)
                              grid: { color: getChartGridColor() }
                          }
                      }
                  }
              });
         } else { console.error("Canvas 'regionSalesChart' no encontrado."); }

         // --- Gráfico de Top Vendedores (Barras Horizontales) ---
         const ctxSeller = document.getElementById('sellerSalesChart')?.getContext('2d');
          if (ctxSeller) {
               if (chartInstances.sellerSales) { try { chartInstances.sellerSales.destroy(); } catch(e){ console.error("Error destruyendo chart sellerSales:", e); } }
               const labels = topSellerData.map(item => item.key);
               const values = topSellerData.map(item => item.value);

               chartInstances.sellerSales = new Chart(ctxSeller, {
                   type: 'bar',
                   data: {
                       labels: labels,
                       datasets: [{
                           label: 'Ventas por Vendedor ($)',
                           data: values,
                           backgroundColor: isDarkMode() ? 'rgba(241, 196, 15, 0.7)' : 'rgba(255, 159, 64, 0.7)', // Naranja/Amarillo
                           borderColor: isDarkMode() ? 'rgba(241, 196, 15, 1)' : 'rgba(255, 159, 64, 1)',
                           borderWidth: 1,
                           borderRadius: 4
                       }]
                   },
                    options: {
                        indexAxis: 'y', // Barras horizontales
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: { display: false /* Título en H3 */ },
                            legend: { display: true, labels: { color: getChartTextColor() } },
                            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed.x)}` } }, // Usar .x para valor en horizontal
                            datalabels: {
                                display: true,
                                anchor: 'end',
                                align: 'right', // A la derecha de la barra
                                formatter: (v) => v !== 0 ? formatCurrency(v / 1000, 0) + 'K' : '', // Formato Miles (K), ocultar si 0
                                font: { size: 9, weight: 'bold' },
                                color: getDatalabelColor(null, 'bar'), // Color dinámico
                                padding: {left: 5} // Pequeño espacio
                            }
                        },
                        scales: {
                            x: { // Eje de valores (horizontal)
                                beginAtZero: true,
                                ticks: { callback: v => formatCurrency(v / 1000000, 1) + 'M', color: getChartTextColor() }, // Formato Millones (M)
                                grid: { color: getChartGridColor() }
                            },
                            y: { // Eje de categorías (vertical)
                                ticks: { color: getChartTextColor() },
                                grid: { display: false } // Ocultar rejilla vertical
                            }
                        }
                    }
               });
          } else { console.error("Canvas 'sellerSalesChart' no encontrado."); }
     }

      function renderCustomerProductCharts(topCustomerData, topProductData) {
          if (!topCustomerData) topCustomerData = [];
          if (!topProductData) topProductData = [];

          // --- Gráfico Top Clientes (Barras Horizontales) ---
          const ctxCustomer = document.getElementById('customerSalesChart')?.getContext('2d');
          if (ctxCustomer) {
               if (chartInstances.customerSales) { try { chartInstances.customerSales.destroy(); } catch(e){ console.error("Error destruyendo chart customerSales:", e); } }
               const labels = topCustomerData.map(item => item.key);
               const values = topCustomerData.map(item => item.value);

               chartInstances.customerSales = new Chart(ctxCustomer, {
                   type: 'bar',
                   data: {
                       labels: labels,
                       datasets: [{
                           label: 'Ventas por Cliente ($)',
                           data: values,
                           backgroundColor: isDarkMode() ? 'rgba(175, 122, 197, 0.7)' : 'rgba(155, 89, 182, 0.7)', // Morado
                           borderColor: isDarkMode() ? 'rgba(175, 122, 197, 1)' : 'rgba(155, 89, 182, 1)',
                           borderWidth: 1,
                           borderRadius: 4
                       }]
                   },
                    options: {
                        indexAxis: 'y', // Barras horizontales
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: { display: false /* Título en H3 */ },
                            legend: { display: true, labels: { color: getChartTextColor() } },
                            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed.x)}` } }, // Usar .x
                            datalabels: {
                                display: true,
                                anchor: 'end',
                                align: 'right',
                                formatter: v => v !== 0 ? formatCurrency(v / 1000, 0) + 'K' : '', // Formato K, ocultar si 0
                                font: { weight: 'bold', size: 9 },
                                color: getDatalabelColor(null, 'bar'), // Color dinámico
                                padding: { left: 5 }
                            }
                        },
                        scales: {
                            x: { // Eje valores
                                beginAtZero: true,
                                ticks: { callback: v => formatCurrency(v / 1000000, 1) + 'M', color: getChartTextColor() }, // Formato M
                                grid: { color: getChartGridColor() }
                            },
                            y: { // Eje categorías
                                ticks: { color: getChartTextColor() },
                                grid: { display: false }
                            }
                        }
                    }
               });
          } else { console.error("Canvas 'customerSalesChart' no encontrado."); }

          // --- Gráfico Top Productos (Barras Horizontales) ---
          const ctxProduct = document.getElementById('productSalesChart')?.getContext('2d');
           if (ctxProduct) {
                if (chartInstances.productSales) { try { chartInstances.productSales.destroy(); } catch(e){ console.error("Error destruyendo chart productSales:", e); } }
                const labels = topProductData.map(item => item.key);
                const values = topProductData.map(item => item.value);

                chartInstances.productSales = new Chart(ctxProduct, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Ventas por Producto ($)',
                            data: values,
                            backgroundColor: isDarkMode() ? 'rgba(245, 176, 81, 0.7)' : 'rgba(230, 126, 34, 0.7)', // Naranja más oscuro
                            borderColor: isDarkMode() ? 'rgba(245, 176, 81, 1)' : 'rgba(230, 126, 34, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                     options: {
                        indexAxis: 'y', // Barras horizontales
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: { display: false /* Título en H3 */ },
                            legend: { display: true, labels: { color: getChartTextColor() } },
                            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed.x)}` } }, // Usar .x
                            datalabels: {
                                display: true,
                                anchor: 'end',
                                align: 'right',
                                formatter: v => v !== 0 ? formatCurrency(v / 1000, 0) + 'K' : '', // Formato K, ocultar si 0
                                font: { weight: 'bold', size: 9 },
                                color: getDatalabelColor(null, 'bar'), // Color dinámico
                                padding: { left: 5 }
                            }
                        },
                        scales: {
                            x: { // Eje valores
                                beginAtZero: true,
                                ticks: { callback: v => formatCurrency(v / 1000000, 1) + 'M', color: getChartTextColor() }, // Formato M
                                grid: { color: getChartGridColor() }
                             },
                             y: { // Eje categorías
                                 ticks: { color: getChartTextColor() },
                                 grid: { display: false }
                             }
                         }
                     }
                });
           } else { console.error("Canvas 'productSalesChart' no encontrado."); }
      }

     function renderParetoChart(paretoResult, barColors) {
          if (!paretoResult || !paretoResult.labels || paretoResult.labels.length === 0) {
            console.warn("renderParetoChart (Producto): Faltan datos o datos inválidos.");
            // Opcional: Limpiar o mostrar mensaje en el canvas si existe
             const ctx = document.getElementById('productParetoChart')?.getContext('2d');
             if(ctx) {
                 if (chartInstances.productPareto) { try { chartInstances.productPareto.destroy(); } catch(e){} }
                 ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
                 ctx.save(); ctx.fillStyle=getChartTextColor(); ctx.textAlign='center'; ctx.font="14px 'Segoe UI'";
                 ctx.fillText("Análisis Pareto no disponible", ctx.canvas.width/2, 50); ctx.restore();
             }
            return;
         }
         if (!barColors) barColors = []; // Asegurar que barColors sea un array

          const ctxPareto = document.getElementById('productParetoChart')?.getContext('2d');
         if (ctxPareto) {
             if (chartInstances.productPareto) { try { chartInstances.productPareto.destroy(); } catch(e){ console.error("Error destruyendo chart productPareto:", e); } }
             // Asegurar que haya tantos colores como etiquetas, usando un color por defecto si faltan
             const defaultColor = isDarkMode() ? 'rgba(128, 128, 128, 0.7)' : 'rgba(150, 150, 150, 0.7)';
             const finalBarColors = paretoResult.labels.map((_, i) => barColors[i] || defaultColor);
             const finalBorderColors = finalBarColors.map(c => c.replace(/rgba?\((\d+,\s*\d+,\s*\d+),\s*[\d.]+\)/, 'rgba($1, 1)')); // Hacer opacidad 1

             chartInstances.productPareto = new Chart(ctxPareto, {
                 type: 'bar', // Tipo base
                 data: {
                     labels: paretoResult.labels,
                     datasets: [
                         {
                             type: 'bar', // Dataset de barras para ventas
                             label: 'Ventas ($)',
                             data: paretoResult.sales,
                             backgroundColor: finalBarColors,
                             borderColor: finalBorderColors,
                             borderWidth: 1,
                             order: 1, // Barras debajo de la línea
                             yAxisID: 'y-sales' // Eje izquierdo
                         },
                         {
                             type: 'line', // Dataset de línea para acumulado %
                             label: 'Acumulado (%)',
                             data: paretoResult.cumulativePercent,
                             borderColor: isDarkMode() ? '#ffffff' : 'rgba(54, 162, 235, 1)', // Blanco o Azul para la línea
                             backgroundColor: 'transparent',
                             fill: false,
                             tension: 0.2, // Suavizado
                             pointRadius: 3,
                             pointBackgroundColor: isDarkMode() ? '#ffffff' : 'rgba(54, 162, 235, 1)',
                             order: 0, // Línea encima de las barras
                             yAxisID: 'y-percent', // Eje derecho
                             spanGaps: false // No conectar si hay datos faltantes (aunque no debería haber en Pareto)
                         }
                     ]
                 },
                 options: {
                     responsive: true,
                     maintainAspectRatio: false,
                     plugins: {
                         title: { display: false /* Título en H3 */ },
                         legend: { labels: { color: getChartTextColor() } },
                         tooltip: {
                             mode: 'index', // Mostrar ambos tooltips
                             intersect: false,
                             callbacks: {
                                 label: ctx => {
                                      const label = ctx.dataset.label || '';
                                      const value = ctx.parsed.y;
                                      if (value === null) return `${label}: N/A`;
                                      if (ctx.dataset.yAxisID === 'y-percent') {
                                           return `${label}: ${formatPercent(value, false, 1)}`; // % Acumulado
                                       } else {
                                           return `${label}: ${formatCurrency(value)}`; // Ventas $
                                       }
                                  }
                             }
                         },
                         datalabels: { display: false } // No mostrar datalabels en Pareto
                     },
                     scales: {
                         x: { // Eje Productos
                             ticks: {
                                 color: getChartTextColor(),
                                 // Opcional: Rotar etiquetas si son muchas o largas
                                 // maxRotation: 90,
                                 // minRotation: 45
                             },
                             grid: { color: getChartGridColor() }
                         },
                         'y-sales': { // Eje Izquierdo (Ventas $)
                             type: 'linear',
                             position: 'left',
                             beginAtZero: true,
                             title: { display: true, text: 'Ventas ($)', color: getChartTextColor() },
                             ticks: {
                                 callback: v => formatCurrency(v / 1000, 0) + 'K', // Formato K
                                 color: getChartTextColor()
                             },
                             grid: { color: getChartGridColor() } // Rejilla principal
                         },
                         'y-percent': { // Eje Derecho (Acumulado %)
                             type: 'linear',
                             position: 'right',
                             beginAtZero: true,
                             max: 100, // Máximo 100%
                             title: { display: true, text: 'Acumulado (%)', color: getChartTextColor() },
                             ticks: {
                                 callback: v => v + '%', // Añadir '%'
                                 color: getChartTextColor()
                             },
                             grid: { drawOnChartArea: false } // No dibujar rejilla para este eje
                         }
                     }
                 }
             });
         } else { console.error("Canvas 'productParetoChart' no encontrado."); }
     }

     function renderCustomerParetoChart(paretoResult, barColors) {
          if (!paretoResult || !paretoResult.labels || paretoResult.labels.length === 0) {
             console.warn("renderCustomerParetoChart: Faltan datos o datos inválidos.");
             const ctx = document.getElementById('customerParetoChart')?.getContext('2d');
             if(ctx) {
                 if (chartInstances.customerPareto) { try { chartInstances.customerPareto.destroy(); } catch(e){} }
                 ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
                 ctx.save(); ctx.fillStyle=getChartTextColor(); ctx.textAlign='center'; ctx.font="14px 'Segoe UI'";
                 ctx.fillText("Análisis Pareto de Clientes no disponible", ctx.canvas.width/2, 50); ctx.restore();
             }
             return;
          }
         if (!barColors) barColors = [];

          const ctxPareto = document.getElementById('customerParetoChart')?.getContext('2d');
         if (ctxPareto) {
             if (chartInstances.customerPareto) { try { chartInstances.customerPareto.destroy(); } catch(e){ console.error("Error destruyendo chart customerPareto:", e); } }

             const defaultColor = isDarkMode() ? 'rgba(128, 128, 128, 0.7)' : 'rgba(150, 150, 150, 0.7)';
             const finalBarColors = paretoResult.labels.map((_, i) => barColors[i] || defaultColor);
             const finalBorderColors = finalBarColors.map(c => c.replace(/rgba?\((\d+,\s*\d+,\s*\d+),\s*[\d.]+\)/, 'rgba($1, 1)'));

             chartInstances.customerPareto = new Chart(ctxPareto, {
                 type: 'bar',
                 data: {
                     labels: paretoResult.labels,
                     datasets: [
                         {
                             type: 'bar',
                             label: 'Ventas ($)',
                             data: paretoResult.sales,
                             backgroundColor: finalBarColors,
                             borderColor: finalBorderColors,
                             borderWidth: 1,
                             order: 1,
                             yAxisID: 'y-sales'
                         },
                         {
                             type: 'line',
                             label: 'Acumulado (%)',
                             data: paretoResult.cumulativePercent,
                             borderColor: isDarkMode() ? '#ffffff' : 'rgba(54, 162, 235, 1)',
                             backgroundColor: 'transparent',
                             fill: false,
                             tension: 0.2,
                             pointRadius: 3,
                             pointBackgroundColor: isDarkMode() ? '#ffffff' : 'rgba(54, 162, 235, 1)',
                             order: 0,
                             yAxisID: 'y-percent',
                             spanGaps: false
                         }
                     ]
                 },
                 options: { // Opciones idénticas a las de Pareto de Productos
                     responsive: true,
                     maintainAspectRatio: false,
                     plugins: {
                         title: { display: false },
                         legend: { labels: { color: getChartTextColor() } },
                         tooltip: {
                             mode: 'index',
                             intersect: false,
                             callbacks: {
                                 label: ctx => {
                                      const label = ctx.dataset.label || '';
                                      const value = ctx.parsed.y;
                                      if (value === null) return `${label}: N/A`;
                                      if (ctx.dataset.yAxisID === 'y-percent') {
                                           return `${label}: ${formatPercent(value, false, 1)}`;
                                       } else {
                                           return `${label}: ${formatCurrency(value)}`;
                                       }
                                  }
                             }
                         },
                         datalabels: { display: false }
                     },
                     scales: {
                         x: {
                             ticks: {
                                 color: getChartTextColor(),
                                 // Podría ser necesario rotar etiquetas si los nombres de cliente son largos
                                 // autoSkip: true, maxTicksLimit: 10 // O limitar el número
                             },
                             grid: { color: getChartGridColor() }
                         },
                         'y-sales': {
                             type: 'linear', position: 'left', beginAtZero: true,
                             title: { display: true, text: 'Ventas ($)', color: getChartTextColor() },
                             ticks: { callback: v => formatCurrency(v / 1000, 0) + 'K', color: getChartTextColor() },
                             grid: { color: getChartGridColor() }
                         },
                         'y-percent': {
                             type: 'linear', position: 'right', beginAtZero: true, max: 100,
                             title: { display: true, text: 'Acumulado (%)', color: getChartTextColor() },
                             ticks: { callback: v => v + '%', color: getChartTextColor() },
                             grid: { drawOnChartArea: false }
                         }
                     }
                 }
             });
         } else { console.error("Canvas 'customerParetoChart' no encontrado."); }
     }

    // =========================================================================
    // === FUNCIONES DE GENERACIÓN DE NARRATIVAS (Completas y Originales con mejoras) ===
    // =========================================================================

    function generateAnnualNarratives(data, elementVentas, elementCrecimiento) {
        if (!data) return;
        if (!elementVentas || !elementCrecimiento) { console.warn("generateAnnualNarratives: Faltan elementos del DOM."); return; }

        const ventaUltimo = data.Venta_2025 ?? 0;
        const ventaPenultimo = data.Venta_2024 ?? 0;
        const crecUltimo = data.Crecimiento_2025_vs_2024; // Puede ser null o undefined

        elementVentas.innerHTML = `El análisis histórico muestra la evolución anual de las ventas. El último año registrado (2025) cerró con un volumen de <strong>${formatCurrency(ventaUltimo)}</strong>. El gráfico de barras adyacente ilustra la trayectoria completa del período analizado.`;

        if (crecUltimo !== undefined && crecUltimo !== null) {
             const tendencia = crecUltimo >= 0 ? 'un crecimiento' : 'un decrecimiento';
             elementCrecimiento.innerHTML = `En comparación con el año anterior (2024: ${formatCurrency(ventaPenultimo)}), el año 2025 experimentó <strong>${tendencia}</strong> del <strong>${formatPercent(crecUltimo, false)}</strong>. Las barras de crecimiento indican visualmente si el cambio fue positivo (verde) o negativo (rojo).`;
        } else {
             elementCrecimiento.innerHTML = `No se dispone de datos comparativos para calcular la tasa de crecimiento entre 2025 y 2024. El último dato de ventas registrado es de ${formatCurrency(ventaUltimo)}.`;
        }
    }

    function generateProfitabilityNarratives(data, elementGrafico, elementTabla) {
        if (!data) return;
        if (!elementGrafico || !elementTabla) { console.warn("generateProfitabilityNarratives: Faltan elementos del DOM."); return; }

        const ingreso = data.Ingreso_Total ?? 0;
        const costo = data.Costo_Total ?? 0;
        const margen = data.Margen_Total ?? 0;
        const margenP = data.Porcentaje_Margen ?? 0; // Usar el valor directo si existe
        // Calcular costo % solo si es necesario y manejar división por cero
        const costoP = ingreso > 0 ? (costo / ingreso) : 0;

        elementGrafico.innerHTML = `El gráfico de barras horizontales descompone el Ingreso Total acumulado (<strong>${formatCurrency(ingreso)}</strong>) en sus componentes principales: Costo Total (<strong>${formatCurrency(costo)}</strong>) y Margen Bruto resultante (<strong>${formatCurrency(margen)}</strong>).`;

        elementTabla.innerHTML = `La tabla de rentabilidad muestra que los costos representan el <strong>${formatPercent(costoP)}</strong> de los ingresos totales. Esto resulta en un Margen Bruto sobre Ventas del <strong>${formatPercent(margenP)}</strong> ${getMarginEmoji(margenP)}. El emoji ofrece una evaluación rápida de la salud de este margen.`;
    }

    function generateDetailTableNarratives(data, elementAnual, elementKpi){
         // No necesita 'data' realmente, solo explica las tablas
         if (elementAnual) {
             elementAnual.innerHTML = `La tabla "Comparativa Anual" detalla las ventas, la diferencia absoluta ($) y el crecimiento porcentual (%) año contra año. Utiliza colores de fondo (verde/rojo/neutro) y un emoji de tendencia (📈/📉/📊) para facilitar la interpretación rápida de la evolución anual.`;
         } else { console.warn("generateDetailTableNarratives: Falta elemento Anual."); }

         if (elementKpi) {
             elementKpi.innerHTML = `La tabla "Indicadores Globales" consolida los KPIs clave acumulados para todo el período analizado. El color de fondo en la celda del valor "Margen Porcentual" proporciona una evaluación visual inmediata de la rentabilidad general del negocio (verde: bueno, amarillo: regular, rojo: bajo).`;
         } else { console.warn("generateDetailTableNarratives: Falta elemento KPI."); }
    }

    function generateGeoSellerNarratives(regionData, topSellerData, totalSalesRecords, elementRegion, elementSeller) {
         if (!elementRegion || !elementSeller) { console.warn("generateGeoSellerNarratives: Faltan elementos del DOM."); return; }

         if (!Array.isArray(regionData) || regionData.length === 0) {
             elementRegion.innerHTML = "<em>No se dispone de datos detallados para analizar las ventas por región.</em>";
         } else {
             const topRegion = regionData[0]; // Ya viene ordenado
             const totalRegionSales = regionData.reduce((sum, r) => sum + r.value, 0);
             const topRegionPercent = totalRegionSales > 0 ? (topRegion.value / totalRegionSales) : 0;
             elementRegion.innerHTML = `Geográficamente, la región <strong>${topRegion.key}</strong> lidera las ventas con <strong>${formatCurrency(topRegion.value)}</strong>, lo que constituye aproximadamente el <strong>${formatPercent(topRegionPercent)}</strong> del total vendido en las ${regionData.length} regiones analizadas. El gráfico de barras muestra la distribución regional.`;
         }

         if (!Array.isArray(topSellerData) || topSellerData.length === 0) {
             elementSeller.innerHTML = "<em>No se dispone de datos detallados para analizar el rendimiento por vendedor.</em>";
         } else {
             const topSeller = topSellerData[0]; // Ya viene ordenado
             elementSeller.innerHTML = `En cuanto al equipo de ventas, <strong>${topSeller.key}</strong> destaca como el vendedor con mayor volumen de ventas, alcanzando <strong>${formatCurrency(topSeller.value)}</strong>. El gráfico adyacente presenta el Top 10 de vendedores basado en el total facturado.`;
         }
    }

    function generateCustomerProductNarratives(topCustomerData, topProductData, totalCustomers, totalProducts, elementCustomer, elementProduct) {
         if (!elementCustomer || !elementProduct) { console.warn("generateCustomerProductNarratives: Faltan elementos del DOM."); return; }

         if (!Array.isArray(topCustomerData) || topCustomerData.length === 0) {
             elementCustomer.innerHTML = "<em>No se dispone de datos detallados para analizar las ventas por cliente.</em>";
         } else {
             const topCustomer = topCustomerData[0];
             elementCustomer.innerHTML = `El cliente <strong>${topCustomer.key}</strong> representa el mayor volumen de compra, con un total de <strong>${formatCurrency(topCustomer.value)}</strong>. El gráfico muestra el Top 10 de clientes (de un total de ${formatNumber(totalCustomers)} clientes únicos registrados en este período).`;
         }

         if (!Array.isArray(topProductData) || topProductData.length === 0) {
             elementProduct.innerHTML = "<em>No se dispone de datos detallados para analizar las ventas por producto.</em>";
         } else {
             const topProduct = topProductData[0];
             elementProduct.innerHTML = `Por el lado de los productos, <strong>${topProduct.key}</strong> es el artículo que más ingresos ha generado, sumando <strong>${formatCurrency(topProduct.value)}</strong>. Se visualiza el Top 10 de productos (de un total de ${formatNumber(totalProducts)} productos distintos vendidos).`;
         }
    }

    function generateParetoNarrative(paretoData, allProductSales, element) {
         if (!element) { console.warn("generateParetoNarrative (Producto): Falta elemento del DOM."); return; }
         if (!paretoData?.labels?.length || !Array.isArray(allProductSales)) {
             element.innerHTML = "<em>Análisis Pareto de Productos no disponible debido a falta de datos.</em>";
             return;
         }

         let categoryCounts = { A: 0, B: 0, C: 0 };
         let salesPercentAt70 = 0; // % exacto donde se corta A/B
         let salesPercentAt90 = 0; // % exacto donde se corta B/C

         paretoData.category.forEach((cat, index) => {
             if (cat === 'A') categoryCounts.A++;
             else if (cat === 'B') categoryCounts.B++;
             else categoryCounts.C++;

             // Encontrar el % acumulado al final de la categoría A y B
             if (cat === 'A' && (index + 1 >= paretoData.category.length || paretoData.category[index + 1] !== 'A')) {
                 salesPercentAt70 = paretoData.cumulativePercent[index];
             }
              if (cat === 'B' && (index + 1 >= paretoData.category.length || paretoData.category[index + 1] !== 'B')) {
                 salesPercentAt90 = paretoData.cumulativePercent[index];
             }
         });
         // Si solo hay A, o A y C, ajustar los porcentajes
         if(salesPercentAt70 === 0 && categoryCounts.A > 0) salesPercentAt70 = paretoData.cumulativePercent[categoryCounts.A - 1] ?? 0;
         if(salesPercentAt90 === 0 && categoryCounts.B > 0) salesPercentAt90 = paretoData.cumulativePercent[categoryCounts.A + categoryCounts.B - 1] ?? 0;
         else if (salesPercentAt90 === 0 && categoryCounts.A > 0) salesPercentAt90 = salesPercentAt70; // Si no hay B, el corte de 90 es el mismo que el de 70


         const totalProducts = allProductSales.length; // Usar longitud del array agregado antes de Pareto
         const vitalPercentOfTotal = totalProducts > 0 ? (categoryCounts.A / totalProducts) : 0;
         const importantPercentOfTotal = totalProducts > 0 ? (categoryCounts.B / totalProducts) : 0;
         const trivialPercentOfTotal = totalProducts > 0 ? (categoryCounts.C / totalProducts) : 0;

         element.innerHTML = `El Principio de Pareto (80/20) aplicado a los productos revela que:
             <ul>
                 <li><strong>${categoryCounts.A} productos 'Vitales'</strong> (Categoría A, Verde), que representan solo el <strong>${formatPercent(vitalPercentOfTotal)}</strong> del catálogo, generan aproximadamente el <strong>${formatPercent(salesPercentAt70, false, 0)}</strong> de las ventas totales.</li>
                 <li><strong>${categoryCounts.B} productos 'Importantes'</strong> (Categoría B, Amarillo), un <strong>${formatPercent(importantPercentOfTotal)}</strong> adicional del catálogo, elevan las ventas acumuladas hasta cerca del <strong>${formatPercent(salesPercentAt90, false, 0)}</strong>.</li>
                 <li>Los restantes <strong>${categoryCounts.C} productos 'Triviales'</strong> (Categoría C, Rojo), aunque son la mayoría en número (<strong>${formatPercent(trivialPercentOfTotal)}</strong>), contribuyen solo al <strong>${formatPercent(100 - salesPercentAt90, false, 0)}</strong> final de los ingresos.</li>
             </ul>
             Este análisis sugiere enfocar esfuerzos de gestión de inventario, marketing y ventas en los productos de categorías A y B.`;
    }

    function generateCustomerParetoNarrative(paretoData, allCustomerSales, element) {
          if (!element) { console.warn("generateCustomerParetoNarrative: Falta elemento del DOM."); return; }
          if (!paretoData?.labels?.length || !Array.isArray(allCustomerSales)) {
              element.innerHTML = "<em>Análisis Pareto de Clientes no disponible debido a falta de datos.</em>";
              return;
          }

          // Lógica idéntica a la de productos, pero aplicada a clientes
          let categoryCounts = { A: 0, B: 0, C: 0 };
          let salesPercentAt70 = 0;
          let salesPercentAt90 = 0;

         paretoData.category.forEach((cat, index) => {
             if (cat === 'A') categoryCounts.A++;
             else if (cat === 'B') categoryCounts.B++;
             else categoryCounts.C++;
             if (cat === 'A' && (index + 1 >= paretoData.category.length || paretoData.category[index + 1] !== 'A')) {
                 salesPercentAt70 = paretoData.cumulativePercent[index];
             }
              if (cat === 'B' && (index + 1 >= paretoData.category.length || paretoData.category[index + 1] !== 'B')) {
                 salesPercentAt90 = paretoData.cumulativePercent[index];
             }
         });
         if(salesPercentAt70 === 0 && categoryCounts.A > 0) salesPercentAt70 = paretoData.cumulativePercent[categoryCounts.A - 1] ?? 0;
         if(salesPercentAt90 === 0 && categoryCounts.B > 0) salesPercentAt90 = paretoData.cumulativePercent[categoryCounts.A + categoryCounts.B - 1] ?? 0;
          else if (salesPercentAt90 === 0 && categoryCounts.A > 0) salesPercentAt90 = salesPercentAt70;

         const totalCustomers = allCustomerSales.length;
         const vitalPercentOfTotal = totalCustomers > 0 ? (categoryCounts.A / totalCustomers) : 0;
         const importantPercentOfTotal = totalCustomers > 0 ? (categoryCounts.B / totalCustomers) : 0;
         const trivialPercentOfTotal = totalCustomers > 0 ? (categoryCounts.C / totalCustomers) : 0;

          element.innerHTML = `Aplicando el análisis Pareto a la base de clientes, observamos una concentración similar:
             <ul>
                 <li>Un grupo selecto de <strong>${categoryCounts.A} clientes 'Clave'</strong> (Categoría A, Verde), que son solo el <strong>${formatPercent(vitalPercentOfTotal)}</strong> del total de clientes, generan alrededor del <strong>${formatPercent(salesPercentAt70, false, 0)}</strong> de los ingresos.</li>
                 <li>Otros <strong>${categoryCounts.B} clientes 'Relevantes'</strong> (Categoría B, Amarillo), correspondientes al <strong>${formatPercent(importantPercentOfTotal)}</strong> de la base, aportan ventas adicionales hasta alcanzar aproximadamente el <strong>${formatPercent(salesPercentAt90, false, 0)}</strong> acumulado.</li>
                 <li>La gran mayoría de <strong>${categoryCounts.C} clientes 'Ocasionales'</strong> (Categoría C, Rojo), el <strong>${formatPercent(trivialPercentOfTotal)}</strong> restante, contribuyen con el <strong>${formatPercent(100 - salesPercentAt90, false, 0)}</strong> final de la facturación.</li>
             </ul>
             Es crucial implementar estrategias de fidelización y servicio diferenciado para los clientes de categoría A y B, que son vitales para el negocio.`;
     }

    function generateOtherAnnualNarratives(data, elementDistribucion, elementTendencia) {
        if (!data) return;
        if (!elementDistribucion || !elementTendencia) { console.warn("generateOtherAnnualNarratives: Faltan elementos del DOM."); return; }

        const years = ['2019','2020', '2021', '2022', '2023', '2024', '2025'];
        const salesData = years.map(year => data[`Venta_${year}`] ?? 0);
        const ventaTotal = salesData.reduce((a,b)=>a+b, 0);
        const ventaUltimo = data.Venta_2025 ?? 0;
        const porcUltimo = ventaTotal > 0 ? (ventaUltimo / ventaTotal) : 0;

        elementDistribucion.innerHTML = `El gráfico de dona muestra la contribución porcentual de cada año al total de ventas acumulado durante el período ${years[0]}-${years[years.length - 1]} (${formatCurrency(ventaTotal)}). En el último año, 2025, las ventas (${formatCurrency(ventaUltimo)}) representaron el <strong>${formatPercent(porcUltimo)}</strong> de este total.`;

        const crecUltimo = data.Crecimiento_2025_vs_2024; // Puede ser null
        elementTendencia.innerHTML = `Este gráfico combinado superpone la evolución de las ventas anuales (barras azules) con la tasa de crecimiento interanual (línea roja). Permite visualizar la relación entre el volumen de ventas y su ritmo de cambio. El crecimiento registrado en 2025 frente a 2024 fue del <strong>${crecUltimo !== null ? formatPercent(crecUltimo, false) : 'N/A'}</strong>.`;
    }

    // --- NUEVA FUNCIÓN PARA GENERAR EL RESUMEN EJECUTIVO ---
    function generateExecutiveSummary(summaryData, regionSales, customerParetoResult, productParetoResult, topProductQty, element) {
        if (!element) { console.warn("generateExecutiveSummary: Falta elemento del DOM."); return; }
        if (!summaryData) {
            element.innerHTML = "<p><em>No se pudieron cargar los datos necesarios para generar el resumen ejecutivo.</em></p>";
            console.warn("generateExecutiveSummary: Faltan datos de resumen (summaryData).");
            return;
        }

        // Extraer datos clave del resumen
        const ingreso = summaryData.Ingreso_Total ?? 0;
        const margenP = summaryData.Porcentaje_Margen ?? 0;
        const diffUltimoAnio = summaryData.Diferencia_2025_vs_2024; // Puede ser null/undefined
        const crecUltimoAnio = summaryData.Crecimiento_2025_vs_2024; // Puede ser null/undefined
        const ventaUltimoAnio = summaryData.Venta_2025 ?? 0;

        // Construir el HTML del resumen
        let summaryHtml = "<h4><i class='fas fa-chart-line'></i> Resumen Ejecutivo Consolidado</h4>";

        // Párrafo 1: Ingresos, Tendencia Reciente y Rentabilidad
        summaryHtml += `<p>📊 El negocio generó un <strong>Ingreso Total</strong> acumulado de <strong class="highlight-key">${formatCurrency(ingreso)}</strong> durante el período analizado. `;
        if (diffUltimoAnio !== undefined && diffUltimoAnio !== null && crecUltimoAnio !== undefined && crecUltimoAnio !== null) {
            summaryHtml += `En el último año (2025 vs 2024), la tendencia fue <strong class="${getConditionalClass(diffUltimoAnio)}">${diffUltimoAnio >= 0 ? 'positiva' : 'negativa'}</strong>, con una variación de ${getTrendEmoji(diffUltimoAnio)} ${formatCurrency(diffUltimoAnio, 0)} (${formatPercent(crecUltimoAnio, false)}). `;
        } else {
            // Fallback si no hay datos de comparación
            summaryHtml += `La venta del último año registrado (2025) fue de <strong class="highlight-key">${formatCurrency(ventaUltimoAnio)}</strong>. `;
        }
        summaryHtml += `La <strong>Rentabilidad Global</strong> (Margen Bruto %) se mantiene en un <strong class="${getConditionalClass(margenP, 0.25, 0.10)}">${formatPercent(margenP)}</strong> ${getMarginEmoji(margenP)}. </p>`;

        // Párrafo 2: Región, Clientes (Pareto) y Productos (Pareto y Cantidad)
        summaryHtml += `<p>`;
        // Región
        if (Array.isArray(regionSales) && regionSales.length > 0) {
            const topRegion = regionSales[0];
            summaryHtml += `🌍 A nivel <strong>regional</strong>, <strong class="highlight-key">${topRegion.key}</strong> es el área de mayor facturación (<strong class="highlight-positive">${formatCurrency(topRegion.value)}</strong>). `;
        } else {
            summaryHtml += `🌍 Análisis regional no disponible. `;
        }

        // Clientes Pareto
        if (customerParetoResult?.labels?.length > 0) {
             let vitalCount = customerParetoResult.category.filter(c => c === 'A').length;
            const topCustomer = customerParetoResult.labels[0];
            summaryHtml += `👥 Según Pareto, <strong>${vitalCount} clientes clave</strong> ('A') concentran ~70% de las ventas, con <strong class="highlight-key">${topCustomer}</strong> a la cabeza. `;
        } else {
            summaryHtml += `👥 Análisis Pareto de clientes no disponible. `;
        }

        // Productos Pareto (Ventas)
        if (productParetoResult?.labels?.length > 0) {
             let vitalCountProd = productParetoResult.category.filter(c => c === 'A').length;
             const topProductSales = productParetoResult.labels[0];
             summaryHtml += `🛒 Igualmente, <strong>${vitalCountProd} productos 'vitales'</strong> ('A') dominan los ingresos por ventas, siendo <strong class="highlight-key">${topProductSales}</strong> el número uno. `;
         } else {
             summaryHtml += `🛒 Análisis Pareto de productos (por ventas) no disponible. `;
         }

         // Productos Top (Cantidad)
         if (Array.isArray(topProductQty) && topProductQty.length > 0) {
            const topProductUnits = topProductQty[0];
             // Acceder a 'quantity' que es la suma de cantidades del campo 'CANTIDAD'
             summaryHtml += `En <strong>unidades vendidas</strong>, <strong class="highlight-key">${topProductUnits.key}</strong> es el más popular (<strong class="highlight-neutral">${formatNumber(topProductUnits.quantity)}</strong> unidades).`;
         } else {
              summaryHtml += `Análisis de productos por unidades vendidas no disponible.`;
         }
         summaryHtml += `</p>`;

        // Párrafo 3: Conclusión y Recomendaciones
        summaryHtml += `<p>🎯 <strong>Conclusión y Foco Estratégico:</strong> La empresa presenta ${ingreso > 5000000 ? 'una base de ingresos consolidada' : 'un volumen de ingresos moderado'}. `
        summaryHtml += `La rentabilidad (${formatPercent(margenP)}) es ${margenP > 0.30 ? '<span class="highlight-positive">sólida</span> 👍' : margenP > 0.15 ? '<span class="highlight-neutral">aceptable</span> 👌' : '<span class="highlight-negative">ajustada y requiere optimización</span> ⚠️'}. `
        summaryHtml += `Se observa una ${ (customerParetoResult?.labels?.length > 0 && productParetoResult?.labels?.length > 0) ? 'clara concentración de ingresos en clientes y productos clave (Pareto A/B), indicando eficiencia pero también dependencia' : 'distribución más equilibrada de ventas entre clientes/productos, o datos insuficientes para concluir'}. `;

        // Mensaje específico sobre tendencia reciente
        if (diffUltimoAnio !== undefined && diffUltimoAnio !== null) {
            if (diffUltimoAnio < 0) {
                summaryHtml += `<strong class="highlight-negative"> La tendencia decreciente en el último período (${formatPercent(crecUltimoAnio, false)}) es un punto crítico a abordar para asegurar la sostenibilidad.</strong>`;
            } else if (diffUltimoAnio > 0) {
                 summaryHtml += `<strong class="highlight-positive"> El crecimiento reciente (${formatPercent(crecUltimoAnio, false)}) es positivo y debe potenciarse.</strong>`;
            } else {
                 summaryHtml += `<strong class="highlight-neutral"> El último período muestra estancamiento en ventas, requiriendo acciones para impulsar el crecimiento.</strong>`;
            }
        } else {
             summaryHtml += ` No hay datos claros sobre la tendencia del último año.`;
        }

         summaryHtml += ` <strong>Recomendaciones:</strong> ${margenP <= 0.15 ? 'Priorizar acciones para mejorar márgenes (costos, precios). ' : ''}${diffUltimoAnio < 0 ? 'Desarrollar estrategias urgentes para revertir la caída de ventas. ' : (diffUltimoAnio == 0 ? 'Implementar iniciativas para reactivar el crecimiento. ' : 'Identificar y replicar los factores del crecimiento reciente. ')} Reforzar la relación con clientes y productos 'A' y 'B'. Explorar oportunidades en la categoría 'C' o considerar su optimización.`;
         summaryHtml += `</p>`;

        element.innerHTML = summaryHtml; // Actualiza el contenido del div del resumen
        console.log("Resumen ejecutivo generado.");
    }


    // =========================================================================
    // === EXPORTACIÓN A PDF (MEJORADO PARA CONTROL DE PÁGINAS) ===============
    // =========================================================================
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            showLoading(true, 'Iniciando exportación a PDF... 0%');
            console.log("📄 Iniciando exportación a PDF...");

            // Verificar dependencias
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
                showErrorState("Error: La librería jsPDF no está cargada. No se puede exportar.");
                console.error("jsPDF no encontrada."); return;
            }
            if (typeof html2canvas === 'undefined') {
                showErrorState("Error: La librería html2canvas no está cargada. No se puede exportar.");
                console.error("html2canvas no encontrada."); return;
            }

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'p', // Portrait
                unit: 'mm',
                format: 'a4'
            });

            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 15; // Margen en mm (arriba, abajo, izquierda, derecha)
            const usablePageHeight = pageHeight - margin * 2;
            const usableWidth = pageWidth - margin * 2;
            const spacingAfterTitle = 4; // Espacio entre título de sección y contenido
            const spacingAfterElement = 8; // Espacio después de cada bloque/imagen
            let yPosition = margin; // Posición Y inicial en la página actual
            let currentPage = 1;
            let hasErrors = false;

            // --- Función para añadir Footer ---
            function addFooter() {
                const pageCount = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    pdf.setPage(i); // Ir a la página i
                    const ts = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
                    const footerY = pageHeight - margin / 2; // Posición Y del footer
                    pdf.setFontSize(8).setFont("helvetica", "italic").setTextColor(128); // Fuente pequeña, gris
                    pdf.text(`Página ${i} de ${pageCount} - Generado el ${ts}`, pageWidth / 2, footerY, { align: 'center' });
                }
                 pdf.setPage(pageCount); // Volver a la última página activa
                 pdf.setFontSize(10).setFont("helvetica", "normal").setTextColor(0); // Restaurar fuente/color
             }

            /**
             * *** NUEVA FUNCIÓN MEJORADA PARA AÑADIR BLOQUES ***
             * Asegura que el título y la imagen del elemento permanezcan juntos.
             * Calcula la altura combinada y añade página ANTES si no caben juntos.
             * @param {string} selector - Selector CSS del elemento a capturar.
             * @param {number} currentY - Posición Y actual en la página.
             * @param {string} title - Título opcional para añadir ANTES del elemento.
             * @returns {Promise<number>} - Nueva posición Y después de añadir el bloque.
             */
            async function addBlockEnsuringAtomicity(selector, currentY, title) {
                const element = document.querySelector(selector);
                // Omitir si el elemento no existe o no es visible (offsetParent es null si display:none o no está en DOM)
                if (!element || !element.offsetParent) {
                    console.warn(`[PDF] Elemento omitido (no encontrado o no visible): ${title || selector}`);
                    // No marcamos como error, simplemente lo saltamos
                    return currentY; // Devolver la misma Y
                }

                 console.log(`[PDF] Procesando bloque: ${title || selector}`);
                 let yPos = currentY; // Usar una variable local para la posición Y dentro de esta función
                 let titleHeight = 0;
                 let titleLines = [];

                 // 1. Calcular altura del título (si existe)
                 if (title) {
                     pdf.setFontSize(14).setFont("helvetica", "bold");
                     titleLines = pdf.splitTextToSize(title, usableWidth);
                     // Usamos getTextDimensions para obtener la altura real del texto renderizado
                     titleHeight = pdf.getTextDimensions(titleLines).h + spacingAfterTitle;
                     pdf.setFontSize(10).setFont("helvetica", "normal"); // Reset font para cálculos de imagen
                 }

                 // 2. Capturar el elemento con html2canvas y calcular altura de la imagen
                 let imgData, imgHeight = 0;
                 try {
                      // Pequeña pausa puede ayudar a que el navegador renderice todo antes de capturar
                     await new Promise(resolve => setTimeout(resolve, 50));
                     const canvas = await html2canvas(element, {
                         scale: 1.5, // Mejor resolución
                         useCORS: true, // Si hay imágenes externas
                         logging: false, // Menos ruido en consola
                         backgroundColor: isDarkMode() ? '#1e1e1e' : '#ffffff' // Fondo según tema
                     });
                     imgData = canvas.toDataURL('image/jpeg', 0.9); // JPEG para menor tamaño
                     const imgProps = pdf.getImageProperties(imgData);
                     // Calcular altura proporcional a la anchura usable, sin exceder la altura usable
                     const proportionalHeight = (imgProps.height * usableWidth) / imgProps.width;
                     imgHeight = Math.min(proportionalHeight, usablePageHeight); // No permitir que una imagen sola ocupe más de una página

                 } catch (error) {
                     console.error(`❌ Error al capturar ${selector} con html2canvas:`, error);
                     hasErrors = true;
                     imgData = null; // Marcar como nulo para no intentar añadirlo
                     imgHeight = 20; // Asignar una altura pequeña para el mensaje de error
                 }

                 // 3. Calcular altura total necesaria (Título + Imagen + Espacio final)
                 const totalElementHeight = titleHeight + imgHeight;

                 // 4. *** LA COMPROBACIÓN CLAVE ***: ¿Cabe el bloque completo (título + imagen) en el espacio restante?
                 if (yPos + totalElementHeight > pageHeight - margin) {
                     // No cabe. Añadir footer a la página ACTUAL (si no es la primera), añadir página nueva, y resetear Y.
                    // Nota: el footer se añadirá globalmente al final, así que no es necesario aquí.
                    // if (currentPage > 0) { /* addFooter() podría ir aquí si quisiéramos paginación en cada salto */ }
                     pdf.addPage();
                     currentPage++;
                     yPos = margin; // Resetear Y a la posición inicial de la nueva página
                     console.log(`   -> Salto de página antes de [${title || selector}]. Nueva página: ${currentPage}`);
                 }

                 // 5. Añadir el título (si existe) en la posición Y calculada (actual o de nueva página)
                 if (titleHeight > 0) {
                     pdf.setFontSize(14).setFont("helvetica", "bold").setTextColor(getChartTitleColor()); // Usar color de título
                     pdf.text(titleLines, margin, yPos + pdf.getTextDimensions('M').h); // Añadir un poco de offset Y para alinear bien
                     pdf.setFontSize(10).setFont("helvetica", "normal").setTextColor(0); // Reset font/color
                     yPos += titleHeight; // Incrementar Y por la altura del título + espacio
                 }

                 // 6. Añadir la imagen (si se generó correctamente)
                 if (imgData) {
                     pdf.addImage(imgData, 'JPEG', margin, yPos, usableWidth, imgHeight);
                     yPos += imgHeight; // Incrementar Y por la altura de la imagen
                 } else {
                     // Si html2canvas falló, añadir un texto de error en el PDF
                     pdf.setFontSize(10).setTextColor(255, 0, 0);
                     pdf.text(`Error al generar la imagen para: ${title || selector}`, margin, yPos + 5);
                     pdf.setTextColor(0);
                     yPos += imgHeight; // Incrementar Y por la altura asignada al error
                 }

                 // 7. Añadir espacio final después del bloque
                 yPos += spacingAfterElement;

                 return yPos; // Devolver la nueva posición Y
            }


            try {
                 // --- Inicio de la Generación del PDF ---

                 // 1. Título Principal del PDF
                 pdf.setFontSize(18).setFont("helvetica", "bold");
                 pdf.text('Dashboard de Ventas - Análisis Detallado', pageWidth / 2, yPosition, { align: 'center' });
                 yPosition += spacingAfterElement * 1.5; // Más espacio después del título principal

                 // 2. Lista ORDENADA de secciones/bloques a capturar
                 // Usamos selectores que apunten al CONTENEDOR específico que queremos capturar.
                 // Puede ser un .chart-container, .table-container, o la sección entera si aplica.
                 const sectionsToCapture = [
                     // KPIs y Resumen primero
                     { selector: '.kpi-section', title: 'Indicadores Clave de Rendimiento (KPIs)' },
                     { selector: '.executive-summary-section', title: 'Resumen Ejecutivo' },

                     // Evolución Anual
                     { selector: 'section[aria-labelledby="evolucion-heading"] .chart-container:nth-of-type(1)', title: 'Ventas Anuales ($)' }, // Primer .chart-container dentro de la sección
                     { selector: 'section[aria-labelledby="evolucion-heading"] .chart-container:nth-of-type(2)', title: 'Crecimiento Anual (%)' }, // Segundo .chart-container

                     // Rentabilidad
                     { selector: 'section[aria-labelledby="rentabilidad-heading"] .chart-container', title: 'Desglose Financiero (Ingreso, Costo, Margen)' },
                     { selector: 'section[aria-labelledby="rentabilidad-heading"] .table-container', title: 'Indicadores de Rentabilidad (%)' },

                     // Tablas de Detalle
                     { selector: 'section[aria-labelledby="detalles-heading"] .table-container:nth-of-type(1)', title: 'Tabla Comparativa Anual Detallada' }, // Primer .table-container
                     { selector: 'section[aria-labelledby="detalles-heading"] .table-container:nth-of-type(2)', title: 'Tabla Resumen de Indicadores Globales' }, // Segundo .table-container

                      // Geo / Vendedor (Verificar si los contenedores son únicos o usar :nth-of-type)
                     { selector: 'section[aria-labelledby="geo-seller-heading"] .chart-container:nth-of-type(1)', title: 'Ventas por Región' },
                     { selector: 'section[aria-labelledby="geo-seller-heading"] .chart-container:nth-of-type(2)', title: 'Top 10 Vendedores por Ventas' },

                      // Cliente / Producto (Verificar selectores)
                     { selector: 'section[aria-labelledby="customer-product-heading"] .chart-container:nth-of-type(1)', title: 'Top 10 Clientes por Ventas' },
                     { selector: 'section[aria-labelledby="customer-product-heading"] .chart-container:nth-of-type(2)', title: 'Top 10 Productos por Ventas ($)' },

                     // Pareto
                     { selector: 'section[aria-labelledby="pareto-heading"] .chart-container', title: 'Análisis Pareto de Productos (Ventas vs Acumulado %)' },
                     { selector: 'section[aria-labelledby="customer-pareto-heading"] .chart-container', title: 'Análisis Pareto de Clientes (Ventas vs Acumulado %)' }, // Asumiendo que tiene su propia sección/heading

                     // Otros Anuales (Verificar selectores)
                     { selector: 'section[aria-labelledby="extra-anual-heading"] .chart-container:nth-of-type(1)', title: 'Distribución Porcentual de Ventas por Año' },
                     { selector: 'section[aria-labelledby="extra-anual-heading"] .chart-container:nth-of-type(2)', title: 'Tendencia Combinada: Ventas ($) vs Crecimiento (%)' },
                 ];

                 // 3. Bucle para capturar cada bloque usando la nueva función
                 for (let i = 0; i < sectionsToCapture.length; i++) {
                     const section = sectionsToCapture[i];
                     const progress = Math.round(((i + 1) / sectionsToCapture.length) * 100);
                     showLoading(true, `Generando PDF: Capturando "${section.title}"... ${progress}%`);

                     // Llamar a la función que asegura atomicidad
                     yPosition = await addBlockEnsuringAtomicity(section.selector, yPosition, section.title);

                     // Pequeña pausa adicional entre bloques grandes puede prevenir sobrecarga
                     await new Promise(resolve => setTimeout(resolve, 100));
                 }

                 // 4. Añadir Footer a TODAS las páginas al final
                 addFooter();

                 // 5. Guardar el PDF
                 console.log("💾 Guardando el archivo PDF...");
                 pdf.save('Dashboard_Ventas_Analisis_Detallado.pdf');

                 // Mostrar mensaje final
                 if (hasErrors) {
                    showLoading(true, 'PDF generado con algunas advertencias ⚠️ (revisar consola)');
                    setTimeout(() => showLoading(false), 4000); // Mensaje más largo si hay errores
                 } else {
                    showLoading(true, 'PDF generado exitosamente 🎉');
                    setTimeout(() => showLoading(false), 2500);
                 }

            } catch (error) {
                 console.error("❌ Error fatal durante la generación del PDF:", error);
                 showErrorState(`No se pudo generar el PDF completo. Causa: ${error.message}`);
                 hasErrors = true; // Marcar que hubo un error grave
            } finally {
                 console.log("📦 Proceso de exportación PDF finalizado.");
                 // Asegurar que el overlay de carga se oculte si no se mostró un mensaje final (poco probable ahora)
                 if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
                     setTimeout(() => showLoading(false), 500);
                 }
            }
        });
    } else {
        console.warn("⚠️ Botón de exportar PDF (#exportPdfBtn) no encontrado en el DOM. La funcionalidad de exportación no estará disponible.");
    }


    // --- Funciones Dark Mode y Update Colors ---
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isEnabled = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isEnabled ? 'enabled' : 'disabled');
        console.log(`Modo oscuro ${isEnabled ? 'activado' : 'desactivado'}. Actualizando colores...`);
        updateChartColors(); // Actualizar gráficos al cambiar modo
        // Actualizar otros elementos si es necesario (ej. tablas con clases específicas de modo)
        // updateTableStyles(); // Podría ser una función separada
    }

    function updateChartColors() {
        console.log("Actualizando colores de los gráficos para el modo:", isDarkMode() ? "Oscuro" : "Claro");
        Object.values(chartInstances).forEach((chart, index) => {
             // Verificar que 'chart' sea una instancia válida de Chart.js
             if (chart && typeof chart.update === 'function' && chart.options) {
                try {
                    // Actualizar colores globales del gráfico
                    if(chart.options.plugins.title) chart.options.plugins.title.color = getChartTitleColor();
                    if(chart.options.plugins.legend?.labels) chart.options.plugins.legend.labels.color = getChartTextColor();

                    // Actualizar ejes
                    Object.values(chart.options.scales || {}).forEach(scale => {
                        if (scale) { // Verificar que la escala exista
                             if (scale.ticks) scale.ticks.color = getChartTextColor();
                             if (scale.grid) scale.grid.color = getChartGridColor();
                             if (scale.title && scale.title.display) scale.title.color = getChartTextColor(); // Solo si el título del eje está visible
                        }
                    });

                    // Actualizar colores de DATALABELS (con cuidado)
                    if(chart.options.plugins.datalabels) {
                         // Si el color NO es una función y NO es blanco fijo, actualizarlo.
                         // Si es blanco fijo (usado para contraste), no lo cambiamos.
                         const currentDatalabelColor = chart.options.plugins.datalabels.color;
                         if (currentDatalabelColor && typeof currentDatalabelColor !== 'function' && currentDatalabelColor !== '#ffffff' && currentDatalabelColor !== 'rgb(255, 255, 255)') {
                              chart.options.plugins.datalabels.color = getDatalabelColor();
                         }
                         // Podríamos necesitar lógica más específica si algunos datalabels deben cambiar y otros no.
                    }

                    // --- Actualización específica de colores de datasets ---
                    // Esto es más complejo y depende del tipo de gráfico y de si los colores son condicionales.
                    // Hay que re-evaluar los colores base de cada dataset según el modo.
                    chart.data.datasets.forEach(dataset => {
                        // Ejemplo: Barras de Ventas Anuales
                        if (chart.canvas.id === 'ventasAnualesChart') {
                             dataset.backgroundColor = isDarkMode() ? 'rgba(82, 190, 128, 0.7)' : 'rgba(52, 152, 219, 0.7)';
                             dataset.borderColor = isDarkMode() ? 'rgba(82, 190, 128, 1)' : 'rgba(41, 128, 185, 1)';
                        }
                        // Ejemplo: Barras de Crecimiento Anual (condicional)
                        else if (chart.canvas.id === 'crecimientoAnualChart' && dataset.label.includes('Crecimiento')) {
                             // Re-calcular colores basados en los datos y el nuevo modo
                             const growthValues = dataset.data; // Obtener los datos del dataset
                             dataset.backgroundColor = growthValues.map(v => v === null ? 'rgba(128, 128, 128, 0.5)' : v >= 0 ? (isDarkMode() ? 'rgba(46, 204, 113, 0.8)' : 'rgba(40, 167, 69, 0.8)') : (isDarkMode() ? 'rgba(231, 76, 60, 0.8)' : 'rgba(220, 53, 69, 0.8)'));
                             dataset.borderColor = growthValues.map(v => v === null ? 'rgba(128, 128, 128, 0.8)' : v >= 0 ? (isDarkMode() ? 'rgba(46, 204, 113, 1)' : 'rgba(39, 174, 96, 1)') : (isDarkMode() ? 'rgba(231, 76, 60, 1)' : 'rgba(192, 57, 43, 1)'));
                        }
                        // Ejemplo: Resumen Financiero
                        else if (chart.canvas.id === 'resumenFinancieroChart') {
                             dataset.backgroundColor = [ isDarkMode() ? 'rgba(82, 190, 128, 0.7)' : 'rgba(52, 152, 219, 0.7)', isDarkMode() ? 'rgba(240, 178, 122, 0.7)' : 'rgba(230, 126, 34, 0.7)', isDarkMode() ? 'rgba(46, 204, 113, 0.7)' : 'rgba(40, 167, 69, 0.7)' ];
                             dataset.borderColor = [ isDarkMode() ? 'rgba(82, 190, 128, 1)' : 'rgba(41, 128, 185, 1)', isDarkMode() ? 'rgba(240, 178, 122, 1)' : 'rgba(192, 57, 43, 1)', isDarkMode() ? 'rgba(46, 204, 113, 1)' : 'rgba(39, 174, 96, 1)' ];
                        }
                         // Ejemplo: Dona de Distribución Anual
                         else if (chart.canvas.id === 'distribucionVentasChart') {
                            // Los colores de la dona son fijos, pero el borde sí cambia
                             dataset.borderColor = isDarkMode() ? '#2c3e50' : '#ffffff';
                         }
                         // Ejemplo: Gráfico combinado Tendencia (barra y línea)
                         else if (chart.canvas.id === 'tendenciaAcumuladaChart') {
                             if (dataset.type === 'bar' || dataset.label === 'Ventas ($)') { // Barras de ventas
                                 dataset.backgroundColor = isDarkMode()?'rgba(93, 173, 226, 0.7)':'rgba(52, 152, 219, 0.7)';
                                 dataset.borderColor = isDarkMode()?'rgba(93, 173, 226, 1)':'rgba(41, 128, 185, 1)';
                             } else if (dataset.type === 'line' || dataset.label === 'Crecimiento (%)') { // Línea de crecimiento
                                 dataset.borderColor = isDarkMode()?'#e74c3c':'#c0392b';
                                 dataset.pointBackgroundColor = isDarkMode()?'#e74c3c':'#c0392b';
                             }
                         }
                         // Ejemplo: Gráfico Región
                         else if (chart.canvas.id === 'regionSalesChart') {
                             dataset.backgroundColor = isDarkMode() ? 'rgba(93, 173, 226, 0.7)' : 'rgba(54, 162, 235, 0.7)';
                             dataset.borderColor = isDarkMode() ? 'rgba(93, 173, 226, 1)' : 'rgba(54, 162, 235, 1)';
                         }
                         // Ejemplo: Gráfico Vendedor
                         else if (chart.canvas.id === 'sellerSalesChart') {
                             dataset.backgroundColor = isDarkMode() ? 'rgba(241, 196, 15, 0.7)' : 'rgba(255, 159, 64, 0.7)';
                             dataset.borderColor = isDarkMode() ? 'rgba(241, 196, 15, 1)' : 'rgba(255, 159, 64, 1)';
                         }
                         // Ejemplo: Gráfico Cliente
                         else if (chart.canvas.id === 'customerSalesChart') {
                              dataset.backgroundColor = isDarkMode() ? 'rgba(175, 122, 197, 0.7)' : 'rgba(155, 89, 182, 0.7)';
                              dataset.borderColor = isDarkMode() ? 'rgba(175, 122, 197, 1)' : 'rgba(155, 89, 182, 1)';
                         }
                         // Ejemplo: Gráfico Producto
                         else if (chart.canvas.id === 'productSalesChart') {
                             dataset.backgroundColor = isDarkMode() ? 'rgba(245, 176, 81, 0.7)' : 'rgba(230, 126, 34, 0.7)';
                             dataset.borderColor = isDarkMode() ? 'rgba(245, 176, 81, 1)' : 'rgba(230, 126, 34, 1)';
                         }
                         // Ejemplo: Gráficos Pareto (Producto y Cliente)
                         else if (chart.canvas.id === 'productParetoChart' || chart.canvas.id === 'customerParetoChart') {
                             if (dataset.type === 'bar') { // Barras con colores condicionales
                                 // Re-calcular colores Pareto A/B/C basados en el modo actual
                                 const COLOR_A = isDarkMode() ? 'rgba(46, 204, 113, 0.8)' : 'rgba(40, 167, 69, 0.8)';
                                 const COLOR_B = isDarkMode() ? 'rgba(241, 196, 15, 0.8)' : 'rgba(255, 193, 7, 0.8)';
                                 const COLOR_C = isDarkMode() ? 'rgba(231, 76, 60, 0.8)' : 'rgba(220, 53, 69, 0.8)';
                                 // Necesitamos la categoría original para cada barra. Asumimos que está disponible en algún lugar o recalcular.
                                 // Si no está fácilmente accesible, esta parte podría fallar o requerir re-cálculo de Pareto.
                                 // SOLUCIÓN TEMPORAL: Si no tenemos la categoría, no actualizamos los colores condicionales aquí.
                                 // console.warn(`Actualización de colores Pareto no implementada completamente para ${chart.canvas.id}`);
                                 // O si la categoría se guardó en el dataset (no estándar):
                                 // dataset.backgroundColor = dataset.categories.map(cat => cat === 'A' ? COLOR_A : cat === 'B' ? COLOR_B : COLOR_C);
                                 // dataset.borderColor = dataset.backgroundColor.map(c => c.replace('0.8', '1'));
                             } else if (dataset.type === 'line') { // Línea de acumulado
                                 dataset.borderColor = isDarkMode() ? '#ffffff' : 'rgba(54, 162, 235, 1)';
                                 dataset.pointBackgroundColor = isDarkMode() ? '#ffffff' : 'rgba(54, 162, 235, 1)';
                             }
                         }
                        // Añadir más 'else if' para otros gráficos si usan colores específicos que deban cambiar con el modo
                    });

                    // Finalmente, actualizar el gráfico para aplicar los cambios
                    chart.update();

                } catch (e) {
                    console.error(`Error actualizando colores del gráfico #${index} (ID: ${chart.canvas?.id || 'desconocido'}):`, e);
                }
            } else if (chart) {
                 console.warn(`Elemento en chartInstances[${index}] no parece ser un gráfico Chart.js válido o no tiene opciones.`);
             }
        });
        console.log("Actualización de colores de gráficos completada.");
    }

    // --- Inicialización General ---
    function initializeApp() {
        console.log("Inicializando aplicación del dashboard...");
        // Aplicar modo oscuro si estaba guardado
        if (localStorage.getItem('darkMode') === 'enabled') {
             document.body.classList.add('dark-mode');
             console.log("Modo oscuro restaurado desde localStorage.");
        }
        // Añadir listener al botón de modo oscuro (si existe)
        if (darkModeBtn) {
             darkModeBtn.addEventListener('click', toggleDarkMode);
        } else {
             console.warn("Botón de modo oscuro (#darkModeBtn) no encontrado.");
        }
        // Deshabilitar botones mientras carga
        if (exportPdfBtn) exportPdfBtn.disabled = true;

        // Iniciar la carga de datos y renderizado
        fetchAndInitializeDashboard();
    }

    // Iniciar la aplicación cuando el DOM esté listo
    initializeApp();

}); // --- FIN del addEventListener('DOMContentLoaded') ---
//<------------------------- FIN CÓDIGO JS COMPLETO ------------------------->
