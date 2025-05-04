// ventas_script.js (Completo y Actualizado con Paginación y Precio Automático)

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const ventaForm = document.getElementById('venta-form');
    const ventaIdInput = document.getElementById('venta-id');
    const fechaInput = document.getElementById('fecha');
    const idPedidoInput = document.getElementById('id_pedido');
    const clienteSelect = document.getElementById('id_cliente');
    const vendedorSelect = document.getElementById('id_vendedor');
    const regionSelect = document.getElementById('id_region');
    const productoSelect = document.getElementById('id_producto');
    const cantidadInput = document.getElementById('cantidad');
    const precioInput = document.getElementById('precio');
    const totalCalculadoSpan = document.getElementById('total-calculado');
    const submitButton = document.getElementById('submit-button');
    const ventasTableBody = document.getElementById('ventas-table-body');
    const formMessage = document.getElementById('form-message');
    const listMessage = document.getElementById('list-message');
    const formSection = document.getElementById('form-section');

    // Referencias para Paginación
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    const paginationNav = document.getElementById('paginationNav');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    // Estado Global
    let editingVentaId = null;
    let productPriceMap = {};
    let currentPage = 1;
    let currentPageSize = parseInt(pageSizeSelect.value); // Tomar valor inicial del select
    let totalItems = 0;
    let totalPages = 0;

    // --- Constantes de API ---
    const API_BASE_URL = '/api';

    // --- Funciones Auxiliares ---
    const showMessage = (element, message, isError = false) => {
        element.textContent = message;
        element.className = `message ${isError ? 'error' : 'success'}`;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    };

    const formatCurrency = (value) => {
        const numValue = parseFloat(value);
        return (isNaN(numValue) ? 0 : numValue).toLocaleString('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const offset = date.getTimezoneOffset();
            const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
            return adjustedDate.toISOString().split('T')[0];
        } catch (e) {
            console.error("Error formateando fecha:", dateString, e);
            return '';
        }
    };

    const calcularTotal = () => {
        const cantidad = parseFloat(cantidadInput.value) || 0;
        const precio = parseFloat(precioInput.value) || 0;
        const total = cantidad * precio;
        totalCalculadoSpan.textContent = formatCurrency(total);
        return total;
    };

    // --- Carga de Datos Iniciales ---
    const loadSelectOptions = async (selectElement, endpoint, valueField, textField) => {
        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`);
            if (!response.ok) throw new Error(`Error ${response.status} cargando ${endpoint}`);
            const data = await response.json();
            const firstOption = selectElement.options[0];
            selectElement.innerHTML = '';
            selectElement.appendChild(firstOption);
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item[valueField];
                option.textContent = item[textField];
                selectElement.appendChild(option);
            });
        } catch (error) {
            console.error(`Error al cargar ${endpoint}:`, error);
            showMessage(formMessage, `No se pudieron cargar datos para ${endpoint}. ${error.message}`, true);
        }
    };

    const loadProductOptions = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/productos`);
            if (!response.ok) throw new Error(`Error ${response.status} cargando productos`);
            const data = await response.json();
            productPriceMap = {};
            const firstOption = productoSelect.options[0];
            productoSelect.innerHTML = '';
            productoSelect.appendChild(firstOption);
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.ID_PRODUCTO;
                option.textContent = item.PRODUCTO;
                productoSelect.appendChild(option);
                productPriceMap[item.ID_PRODUCTO] = item.PRECIO_VENTA;
            });
            // console.log("Mapa de precios de productos cargado:", productPriceMap);
        } catch (error) {
            console.error(`Error al cargar productos:`, error);
            showMessage(formMessage, `No se pudieron cargar los productos. ${error.message}`, true);
        }
    };

    const loadInitialData = async () => {
        await Promise.all([ // Cargar selects en paralelo
            loadSelectOptions(clienteSelect, 'clientes', 'ID_CLIENTE', 'NOMBRE_CLIENTE'),
            loadSelectOptions(vendedorSelect, 'vendedores', 'ID_VENDEDOR', 'VENDEDOR'),
            loadSelectOptions(regionSelect, 'regiones', 'ID_REGION', 'REGION'),
            loadProductOptions()
        ]);
        await loadVentas(); // Cargar tabla inicial (página 1)
    };

    // --- Carga y Renderizado de Ventas (Paginado) ---
    const loadVentas = async (page = currentPage, pageSize = currentPageSize) => {
        ventasTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Cargando ventas...</td></tr>`;
        paginationInfo.textContent = 'Cargando...';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        listMessage.style.display = 'none'; // Ocultar mensajes anteriores

        try {
            const url = `${API_BASE_URL}/ventas?page=${page}&pageSize=${pageSize}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error ${response.status} obteniendo ventas`);
            const result = await response.json();

            currentPage = result.currentPage;
            currentPageSize = result.pageSize; // Asegurarse que el tamaño es el devuelto por la API
            totalItems = result.totalItems;
            totalPages = result.totalPages;

            renderTable(result.data);
            renderPaginationControls();
             // Actualizar el select de tamaño por si la API devolvió uno diferente (ej. valor por defecto)
             if (pageSizeSelect.value != currentPageSize) {
                pageSizeSelect.value = currentPageSize;
             }


        } catch (error) {
            console.error('Error al cargar ventas paginadas:', error);
            ventasTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">Error al cargar ventas: ${error.message}</td></tr>`;
            paginationInfo.textContent = 'Error al cargar';
            showMessage(listMessage, `Error al cargar la lista: ${error.message}`, true);
             paginationNav.style.display = 'none'; // Ocultar controles si hay error grave
        }
    };

    const renderTable = (ventasData) => {
        ventasTableBody.innerHTML = '';
        if (!ventasData || ventasData.length === 0) {
            if (totalItems === 0) {
                ventasTableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No hay ventas registradas.</td></tr>';
            } else {
                ventasTableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No hay ventas en esta página.</td></tr>';
            }
            return;
        }
        ventasData.forEach(venta => {
            const row = ventasTableBody.insertRow();
            row.innerHTML = `
                 <td>${formatDateForInput(venta.FECHA)}</td>
                 <td>${venta.ID_PEDIDO}</td>
                 <td>${venta.NOMBRE_CLIENTE || 'N/A'}</td>
                 <td>${venta.NOMBRE_VENDEDOR || 'N/A'}</td>
                 <td>${venta.NOMBRE_PRODUCTO || 'N/A'}</td>
                 <td>${venta.NOMBRE_REGION || 'N/A'}</td>
                 <td style="text-align: right;">${venta.CANTIDAD}</td>
                 <td style="text-align: right;">${formatCurrency(venta.PRECIO)}</td>
                 <td style="text-align: right;">${formatCurrency(venta.TOTAL)}</td>
                 <td class="action-buttons">
                     <button class="edit-btn" data-id="${venta.ID_PEDIDO}" title="Editar"><i class="fas fa-edit"></i></button>
                     <button class="delete-btn" data-id="${venta.ID_PEDIDO}" title="Eliminar"><i class="fas fa-trash"></i></button>
                 </td>
             `;
        });
    };

    const renderPaginationControls = () => {
        if (totalItems === 0) {
            paginationInfo.textContent = "No hay registros";
            prevPageBtn.disabled = true;
            nextPageBtn.disabled = true;
            paginationNav.style.display = 'none';
            return;
        }
        paginationNav.style.display = 'flex';
        const startItem = (currentPage - 1) * currentPageSize + 1;
        const endItem = Math.min(startItem + currentPageSize - 1, totalItems);
        paginationInfo.textContent = `Mostrando ${startItem}-${endItem} de ${totalItems} (Pág. ${currentPage}/${totalPages})`;
        prevPageBtn.disabled = (currentPage === 1);
        nextPageBtn.disabled = (currentPage === totalPages);
    };

    // --- Manejo del Formulario ---
    window.resetFormularioVenta = () => { // Exponer globalmente
        ventaForm.reset();
        ventaIdInput.value = '';
        precioInput.value = '';
        editingVentaId = null;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Guardar Venta';
        submitButton.disabled = false; // Asegurar habilitado
        idPedidoInput.disabled = false;
        formMessage.style.display = 'none';
        clienteSelect.selectedIndex = 0;
        vendedorSelect.selectedIndex = 0;
        regionSelect.selectedIndex = 0;
        productoSelect.selectedIndex = 0;
        calcularTotal();
    };

    const populateFormForEdit = async (idPedido) => {
        resetFormularioVenta(); // Limpiar siempre primero
        try {
            const response = await fetch(`${API_BASE_URL}/ventas/${idPedido}`);
            if (!response.ok) {
                if (response.status === 404) throw new Error(`Venta ${idPedido} no encontrada.`);
                throw new Error(`Error ${response.status} obteniendo datos.`);
            }
            const venta = await response.json();

            editingVentaId = venta.ID_PEDIDO;
            ventaIdInput.value = venta.ID_PEDIDO;
            fechaInput.value = formatDateForInput(venta.FECHA);
            idPedidoInput.value = venta.ID_PEDIDO;
            idPedidoInput.disabled = true;
            clienteSelect.value = venta.ID_CLIENTE;
            vendedorSelect.value = venta.ID_VENDEDOR;
            regionSelect.value = venta.ID_REGION;
            productoSelect.value = venta.ID_PRODUCTO;
            cantidadInput.value = venta.CANTIDAD;
            precioInput.value = venta.PRECIO;
            calcularTotal();

            submitButton.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Venta';
            window.scrollTo({ top: formSection.offsetTop - 20, behavior: 'smooth' });

        } catch (error) {
            console.error('Error al preparar edición:', error);
            showMessage(formMessage, `Error al cargar datos para editar: ${error.message}`, true);
        }
    };

    ventaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!ventaForm.checkValidity()) {
            showMessage(formMessage, 'Complete los campos requeridos.', true);
            ventaForm.reportValidity();
            return;
        }

        const totalCalculado = calcularTotal();
        const ventaData = {
            fecha: fechaInput.value,
            id_pedido: parseInt(idPedidoInput.value),
            id_cliente: parseInt(clienteSelect.value),
            id_vendedor: parseInt(vendedorSelect.value),
            id_region: parseInt(regionSelect.value),
            id_producto: parseInt(productoSelect.value),
            cantidad: parseInt(cantidadInput.value),
            precio: parseFloat(precioInput.value),
            total: totalCalculado
        };

        const method = editingVentaId ? 'PUT' : 'POST';
        const url = editingVentaId ? `${API_BASE_URL}/ventas/${editingVentaId}` : `${API_BASE_URL}/ventas`;

        const actionText = editingVentaId ? 'actualizar' : 'guardar';
        const savingText = editingVentaId ? 'Actualizando...' : 'Guardando...';
        const successText = editingVentaId ? 'actualizada' : 'creada';
        const buttonIcon = editingVentaId ? 'sync-alt' : 'save';
        const buttonText = editingVentaId ? 'Actualizar Venta' : 'Guardar Venta';

        submitButton.disabled = true;
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${savingText}`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ventaData),
            });

            const result = await response.json(); // Intentar leer siempre, incluso con error

            if (!response.ok) {
                throw new Error(result.message || `Error ${response.status} al ${actionText}.`);
            }

            showMessage(formMessage, result.message || `Venta ${successText} correctamente.`, false);
            resetFormularioVenta();
            await loadVentas(currentPage, currentPageSize); // Recargar página actual

        } catch (error) {
            console.error(`Error al ${actionText} venta:`, error);
            showMessage(formMessage, error.message || `Ocurrió un error inesperado.`, true);
            // Restaurar botón incluso si hay error
            submitButton.disabled = false;
            submitButton.innerHTML = `<i class="fas fa-${buttonIcon}"></i> ${buttonText}`;
        }
        // No se necesita finally porque resetFormularioVenta restaura el botón en caso de éxito
    });

    // --- Manejo de Acciones en la Tabla ---
    ventasTableBody.addEventListener('click', async (event) => {
        const target = event.target;
        const editButton = target.closest('.edit-btn');
        const deleteButton = target.closest('.delete-btn');

        if (editButton) {
            const idPedido = editButton.dataset.id;
            await populateFormForEdit(idPedido);
        } else if (deleteButton) {
            const idPedido = deleteButton.dataset.id;
            if (confirm(`¿Eliminar venta con ID Pedido ${idPedido}?`)) {
                deleteButton.disabled = true;
                deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    const response = await fetch(`${API_BASE_URL}/ventas/${idPedido}`, { method: 'DELETE' });
                    const result = await response.json(); // Leer siempre

                    if (!response.ok) {
                        throw new Error(result.message || `Error ${response.status} al eliminar.`);
                    }

                    showMessage(listMessage, result.message || 'Venta eliminada.', false);
                    // Decidir si recargar página actual o ir a la primera si la actual queda vacía
                     const itemsOnCurrentPageAfterDelete = totalItems % currentPageSize;
                     // Si estamos en la última página y es el último item de esa página, retroceder si no es la pág 1
                     if (currentPage === totalPages && itemsOnCurrentPageAfterDelete === 1 && currentPage > 1) {
                         currentPage--;
                     }
                     await loadVentas(currentPage, currentPageSize);

                } catch (error) {
                    console.error('Error al eliminar venta:', error);
                    showMessage(listMessage, error.message || 'Error al eliminar.', true);
                    // Restaurar botón si falla
                    deleteButton.disabled = false;
                    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                }
            }
        }
    });

    // --- Event Listeners Adicionales ---
    cantidadInput.addEventListener('input', calcularTotal);
    precioInput.addEventListener('input', calcularTotal);

    productoSelect.addEventListener('change', (event) => {
        const selectedProductId = event.target.value;
        if (selectedProductId && productPriceMap[selectedProductId] !== undefined) {
            precioInput.value = productPriceMap[selectedProductId];
        } else {
            precioInput.value = '';
        }
        calcularTotal(); // Calcular siempre después de cambiar precio
    });

    // --- Listeners Paginación ---
    pageSizeSelect.addEventListener('change', (event) => {
        currentPageSize = parseInt(event.target.value);
        currentPage = 1; // Resetear a página 1
        loadVentas(currentPage, currentPageSize);
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadVentas(currentPage, currentPageSize);
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadVentas(currentPage, currentPageSize);
        }
    });

    // --- Inicialización ---
    loadInitialData();

}); // Fin DOMContentLoaded