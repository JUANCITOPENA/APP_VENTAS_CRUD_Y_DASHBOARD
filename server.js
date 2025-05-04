// server.js (Completo y Actualizado con Endpoint Detallado)

const express = require('express');
const sql = require('mssql');
const path = require('path');

const app = express();
const port = 3000; // O el puerto que prefieras

// --- Configuración de la Base de Datos ---
const dbConfig = {
    user: 'TU USUARIO DEL SERVIDOR',
    password: 'TU CLAVE', // ¡INSEGURO! Usa métodos seguros.
    server: 'TU NOMBRE DE SERVIDOR',
    database: 'TU BASE DE DATOS',
    options: {
        encrypt: true, // Ajusta según tu configuración de SQL Server
        trustServerCertificate: true // Ajusta según tu configuración de SQL Server
    },
};

// --- Middlewares ---
app.use(express.json()); // Para parsear JSON
app.use(express.urlencoded({ extended: true })); // Para parsear URL-encoded

// --- Pool de Conexiones (Mejor práctica) ---
let pool;
async function connectDb() {
    try {
        // Si no hay pool o si el pool existente no está conectado, crear uno nuevo
        if (!pool || !pool.connected) {
            if (pool) {
                console.log("Cerrando pool de conexión existente.");
                await pool.close().catch(err => console.error("Error al cerrar pool previo:", err)); // Cerrar si existe
            }
            console.log("Creando nuevo pool de conexión SQL...");
            pool = await sql.connect(dbConfig);
            console.log("Pool de conexión SQL creado y conectado.");
            // Manejador de errores para el pool
            pool.on('error', async (err) => {
                console.error('Error en el Pool de SQL Server:', err);
                // Intentar cerrar el pool fallido y marcarlo como nulo para forzar reconexión
                if (pool) {
                    await pool.close().catch(closeErr => console.error("Error al cerrar pool después de error:", closeErr));
                }
                pool = null;
            });
        }
        return pool;
    } catch (err) {
        console.error('Error fatal conectando a SQL Server:', err);
        pool = null; // Asegurar que no se use un pool fallido
        throw err; // Propagar el error para que las rutas fallen si no hay conexión
    }
}
// Llama a connectDb al inicio para establecer la conexión principal o verificarla
connectDb().catch(err => console.error("Fallo al conectar a la BD al inicio", err));


// --- Helper para ejecutar consultas (maneja reconexión básica) ---
async function executeQuery(query, params = []) {
    let currentPool;
    try {
        currentPool = await connectDb(); // Obtener o crear/reconectar el pool
        const request = currentPool.request();
        params.forEach(param => {
            // Conversión segura a tipos numéricos
            if ((param.type === sql.Decimal || param.type === sql.Int || param.type === sql.Float) && param.value !== null && param.value !== undefined) {
                 const numValue = Number(param.value);
                 if(isNaN(numValue)) {
                    console.warn(`Valor inválido (${param.value}) para tipo numérico en parámetro ${param.name}. Usando NULL.`);
                    param.value = null; // O lanzar error si prefieres: throw new Error(...)
                 } else {
                    param.value = numValue;
                 }
            } else if (param.value === undefined) {
                // Asegurar que undefined se trate como NULL si es necesario
                 param.value = null;
            }
            request.input(param.name, param.type, param.value);
        });
        const result = await request.query(query);
        return result; // Devolver el objeto completo (con recordset, rowsAffected)
    } catch (err) {
        console.error('Error ejecutando consulta SQL:', err.message);
        console.error('Consulta:', query);
        // Si el error es de conexión, intentar invalidar el pool para la próxima vez
        if (err.code === 'ESOCKET' || err.code === 'ECONNRESET' || err.message.includes('Connection is closed')) {
            console.error('Error de conexión detectado, invalidando pool.');
            if (pool) {
               await pool.close().catch(closeErr => console.error("Error al cerrar pool tras error de consulta:", closeErr));
            }
            pool = null;
        }
        // Lanzar un error más específico para que el endpoint lo maneje
        throw new Error(`Error en base de datos al ejecutar consulta: ${err.message}`);
    }
    // Nota: No cerramos el pool aquí, se mantiene abierto para reutilizar.
}


// --- Endpoint de API para el Dashboard (Resumen) ---
app.get('/api/datos-dashboard', async (req, res) => {
    console.log("Recibida petición a /api/datos-dashboard");
    try {
        const result = await executeQuery('SELECT * FROM NUEVA_VISTA_ANALISIS_VENTAS_v1');
        console.log("Consulta a NUEVA_VISTA_ANALISIS_VENTAS ejecutada.");

        if (result.recordset && result.recordset.length > 0) {
            res.json(result.recordset[0]);
            console.log("Datos del dashboard enviados al cliente.");
        } else {
            console.warn("La vista NUEVA_VISTA_ANALISIS_VENTAS no devolvió resultados.");
            res.status(404).json({ message: 'No se encontraron datos resumen en la vista SQL.', data: {} });
        }
    } catch (err) {
        console.error('Error en /api/datos-dashboard:', err.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener datos resumen del dashboard.', error: err.message });
    }
});

// --- Endpoint de API para Datos Detallados del Dashboard ---
app.get('/api/dashboard-detail-data', async (req, res) => {
    console.log("Recibida petición a /api/dashboard-detail-data");
    try {
        const query = `
            SELECT
                V.FECHA,
                V.TOTAL,
                V.CANTIDAD,
                V.ID_PRODUCTO,
                V.ID_REGION,
                V.ID_VENDEDOR,
                V.ID_CLIENTE,
                ISNULL(R.REGION, 'Desconocida') AS NOMBRE_REGION,
                ISNULL(VD.VENDEDOR, 'Desconocido') AS NOMBRE_VENDEDOR,
                ISNULL(P.PRODUCTO, 'Desconocido') AS NOMBRE_PRODUCTO,
                ISNULL(C.NOMBRE_CLIENTE, 'Desconocido') AS NOMBRE_CLIENTE
            FROM VENTAS V
            LEFT JOIN REGION R ON V.ID_REGION = R.ID_REGION
            LEFT JOIN VENDEDOR VD ON V.ID_VENDEDOR = VD.ID_VENDEDOR
            LEFT JOIN PRODUCTO P ON V.ID_PRODUCTO = P.ID_PRODUCTO
            LEFT JOIN CLIENTE C ON V.ID_CLIENTE = C.ID_CLIENTE
            ORDER BY V.FECHA DESC; -- Ordenar puede ayudar, aunque se procesa en frontend
        `;
        const result = await executeQuery(query);
        console.log(`Consulta detallada ejecutada. Filas obtenidas: ${result.recordset.length}`);

        // Siempre devolver un array, incluso si está vacío
        res.json(result.recordset || []);
        console.log("Datos detallados del dashboard enviados al cliente.");

    } catch (err) {
        console.error('Error en /api/dashboard-detail-data:', err.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener datos detallados.', error: err.message });
    }
});


// --- Rutas API para CRUD VENTAS y Selects (SIN CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR) ---

// GET: Clientes
app.get('/api/clientes', async (req, res) => {
    try {
        const query = 'SELECT ID_CLIENTE, NOMBRE_CLIENTE FROM CLIENTE ORDER BY NOMBRE_CLIENTE';
        const result = await executeQuery(query);
        res.json(result.recordset || []); // Devolver array vacío si no hay resultados
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener clientes', error: err.message });
    }
});

// GET: Vendedores
app.get('/api/vendedores', async (req, res) => {
    try {
        const query = 'SELECT ID_VENDEDOR, VENDEDOR FROM VENDEDOR ORDER BY VENDEDOR';
        const result = await executeQuery(query);
        res.json(result.recordset || []);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener vendedores', error: err.message });
    }
});

// GET: Regiones
app.get('/api/regiones', async (req, res) => {
    try {
        const query = 'SELECT ID_REGION, REGION FROM REGION ORDER BY REGION';
        const result = await executeQuery(query);
        res.json(result.recordset || []);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener regiones', error: err.message });
    }
});

// GET: Productos (con precio)
app.get('/api/productos', async (req, res) => {
    try {
        const query = 'SELECT ID_PRODUCTO, PRODUCTO, PRECIO_VENTA FROM PRODUCTO ORDER BY PRODUCTO';
        const result = await executeQuery(query);
        res.json(result.recordset || []);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener productos', error: err.message });
    }
});

// GET: Obtener ventas PAGINADAS (para la tabla de gestión)
app.get('/api/ventas', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSizeQuery = parseInt(req.query.pageSize);
    const validPageSizes = [10, 25, 50, 100];
    const finalPageSize = validPageSizes.includes(pageSizeQuery) ? pageSizeQuery : 10;
    const offset = (page - 1) * finalPageSize;

    try {
        // Query 1: Contar total
        const countQuery = 'SELECT COUNT(*) AS totalItems FROM VENTAS';
        const countResult = await executeQuery(countQuery);
        const totalItems = countResult.recordset[0].totalItems;

        // Query 2: Obtener datos paginados
        const dataQuery = `
            SELECT V.FECHA, V.ID_PEDIDO, V.CANTIDAD, V.PRECIO, V.TOTAL,
                   C.NOMBRE_CLIENTE, VD.VENDEDOR AS NOMBRE_VENDEDOR,
                   P.PRODUCTO AS NOMBRE_PRODUCTO, R.REGION AS NOMBRE_REGION,
                   V.ID_CLIENTE, V.ID_VENDEDOR, V.ID_REGION, V.ID_PRODUCTO -- Incluir IDs por si se necesitan
            FROM VENTAS V
            LEFT JOIN CLIENTE C ON V.ID_CLIENTE = C.ID_CLIENTE
            LEFT JOIN VENDEDOR VD ON V.ID_VENDEDOR = VD.ID_VENDEDOR
            LEFT JOIN PRODUCTO P ON V.ID_PRODUCTO = P.ID_PRODUCTO
            LEFT JOIN REGION R ON V.ID_REGION = R.ID_REGION
            ORDER BY V.FECHA DESC, V.ID_PEDIDO DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
        `;
        const params = [
            { name: 'offset', type: sql.Int, value: offset },
            { name: 'pageSize', type: sql.Int, value: finalPageSize }
        ];
        const dataResult = await executeQuery(dataQuery, params);

        res.json({
            data: dataResult.recordset || [],
            totalItems: totalItems,
            currentPage: page,
            pageSize: finalPageSize,
            totalPages: Math.ceil(totalItems / finalPageSize)
        });

    } catch (err) {
        console.error('Error al obtener la lista de ventas paginada:', err.message);
        res.status(500).json({ message: 'Error al obtener la lista de ventas', error: err.message });
    }
});

// GET: Obtener una venta específica por ID_PEDIDO (para editar)
app.get('/api/ventas/:idPedido', async (req, res) => {
    const { idPedido } = req.params;
     if (isNaN(parseInt(idPedido))) {
        return res.status(400).json({ message: 'ID de Pedido inválido.' });
    }
    try {
        const query = 'SELECT * FROM VENTAS WHERE ID_PEDIDO = @idPedido';
        const params = [{ name: 'idPedido', type: sql.Int, value: parseInt(idPedido) }];
        const result = await executeQuery(query, params);

        if (result.recordset && result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ message: `Venta con ID Pedido ${idPedido} no encontrada.` });
        }
    } catch (err) {
        res.status(500).json({ message: `Error al obtener la venta ${idPedido}`, error: err.message });
    }
});

// POST: Crear una nueva venta
app.post('/api/ventas', async (req, res) => {
    const { fecha, id_pedido, id_cliente, id_vendedor, id_region, id_producto, cantidad, precio } = req.body;

    // Validaciones más robustas
    if (!fecha || id_pedido == null || id_cliente == null || id_vendedor == null || id_region == null || id_producto == null || cantidad == null || precio == null) {
        return res.status(400).json({ message: 'Faltan datos requeridos (fecha, ids, cantidad, precio).' });
    }
     const numCantidad = parseInt(cantidad);
     const numPrecio = parseFloat(precio);
     const numIdPedido = parseInt(id_pedido);

    if (isNaN(numCantidad) || numCantidad <= 0 || isNaN(numPrecio) || numPrecio < 0 || isNaN(numIdPedido)) {
         return res.status(400).json({ message: 'ID Pedido y Cantidad deben ser enteros positivos, Precio debe ser numérico no negativo.' });
    }

    const total = numCantidad * numPrecio;
    const fechaActual = new Date();

    try {
        const checkQuery = 'SELECT 1 FROM VENTAS WHERE ID_PEDIDO = @id_pedido'; // Más eficiente que COUNT(*)
        const checkParams = [{ name: 'id_pedido', type: sql.Int, value: numIdPedido }];
        const checkResult = await executeQuery(checkQuery, checkParams);
        if (checkResult.recordset && checkResult.recordset.length > 0) {
            return res.status(409).json({ message: `El ID de Pedido ${numIdPedido} ya existe.` });
        }

        const query = `
            INSERT INTO VENTAS (FECHA, ID_PEDIDO, ID_CLIENTE, ID_VENDEDOR, ID_REGION, ID_PRODUCTO, CANTIDAD, PRECIO, TOTAL, fecha_creacion, fecha_actualizacion)
            VALUES (@fecha, @id_pedido, @id_cliente, @id_vendedor, @id_region, @id_producto, @cantidad, @precio, @total, @fecha_creacion, @fecha_actualizacion);`;
        const params = [
            { name: 'fecha', type: sql.Date, value: fecha },
            { name: 'id_pedido', type: sql.Int, value: numIdPedido },
            { name: 'id_cliente', type: sql.Int, value: parseInt(id_cliente) }, // Asegurar Int
            { name: 'id_vendedor', type: sql.Int, value: parseInt(id_vendedor) },
            { name: 'id_region', type: sql.Int, value: parseInt(id_region) },
            { name: 'id_producto', type: sql.Int, value: parseInt(id_producto) },
            { name: 'cantidad', type: sql.Int, value: numCantidad },
            { name: 'precio', type: sql.Decimal(10, 2), value: numPrecio },
            { name: 'total', type: sql.Decimal(12, 2), value: total },
            { name: 'fecha_creacion', type: sql.DateTime, value: fechaActual },
            { name: 'fecha_actualizacion', type: sql.DateTime, value: fechaActual }
        ];

        await executeQuery(query, params);
        res.status(201).json({ message: `Venta con ID Pedido ${numIdPedido} creada exitosamente.` });

    } catch (err) {
        // Capturar errores específicos de FK de forma más genérica
        if (err.message.toLowerCase().includes('foreign key constraint')) {
             return res.status(400).json({ message: 'Error de referencia: Cliente, Vendedor, Región o Producto no válido.', errorDetail: err.message });
        } else if (err.message.toLowerCase().includes('cannot insert null')) {
             return res.status(400).json({ message: 'Error: Uno de los campos requeridos (IDs) es nulo.', errorDetail: err.message });
        }
        console.error("Error detallado al crear venta:", err); // Log completo del error
        res.status(500).json({ message: 'Error interno al crear la venta', error: err.message });
    }
});


// PUT: Actualizar una venta existente
app.put('/api/ventas/:idPedido', async (req, res) => {
    const { idPedido } = req.params;
    const { fecha, id_cliente, id_vendedor, id_region, id_producto, cantidad, precio } = req.body;

     // Validaciones
     if (isNaN(parseInt(idPedido))) {
        return res.status(400).json({ message: 'ID de Pedido inválido en la URL.' });
    }
    if (!fecha || id_cliente == null || id_vendedor == null || id_region == null || id_producto == null || cantidad == null || precio == null) {
        return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
     const numCantidad = parseInt(cantidad);
     const numPrecio = parseFloat(precio);
    if (isNaN(numCantidad) || numCantidad <= 0 || isNaN(numPrecio) || numPrecio < 0) {
         return res.status(400).json({ message: 'Cantidad/Precio inválidos.' });
    }

    const total = numCantidad * numPrecio;
    const fechaActual = new Date();
    const numIdPedido = parseInt(idPedido);

    try {
         const query = `
            UPDATE VENTAS SET
                FECHA = @fecha, ID_CLIENTE = @id_cliente, ID_VENDEDOR = @id_vendedor,
                ID_REGION = @id_region, ID_PRODUCTO = @id_producto, CANTIDAD = @cantidad,
                PRECIO = @precio, TOTAL = @total, fecha_actualizacion = @fecha_actualizacion
            WHERE ID_PEDIDO = @idPedido;`;
         const params = [
            { name: 'fecha', type: sql.Date, value: fecha },
            { name: 'id_cliente', type: sql.Int, value: parseInt(id_cliente) },
            { name: 'id_vendedor', type: sql.Int, value: parseInt(id_vendedor) },
            { name: 'id_region', type: sql.Int, value: parseInt(id_region) },
            { name: 'id_producto', type: sql.Int, value: parseInt(id_producto) },
            { name: 'cantidad', type: sql.Int, value: numCantidad },
            { name: 'precio', type: sql.Decimal(10, 2), value: numPrecio },
            { name: 'total', type: sql.Decimal(12, 2), value: total },
            { name: 'fecha_actualizacion', type: sql.DateTime, value: fechaActual },
            { name: 'idPedido', type: sql.Int, value: numIdPedido }
        ];

        const result = await executeQuery(query, params);

        if (result.rowsAffected[0] > 0) {
            res.json({ message: `Venta con ID Pedido ${numIdPedido} actualizada exitosamente.` });
        } else {
             res.status(404).json({ message: `Venta con ID Pedido ${numIdPedido} no encontrada para actualizar.` });
        }

    } catch (err) {
         if (err.message.toLowerCase().includes('foreign key constraint')) {
             return res.status(400).json({ message: 'Error de referencia al actualizar.', errorDetail: err.message });
        } else if (err.message.toLowerCase().includes('cannot insert null')) {
             return res.status(400).json({ message: 'Error: Uno de los campos requeridos (IDs) es nulo.', errorDetail: err.message });
        }
        console.error("Error detallado al actualizar venta:", err);
        res.status(500).json({ message: `Error interno al actualizar la venta ${idPedido}`, error: err.message });
    }
});

// DELETE: Eliminar una venta
app.delete('/api/ventas/:idPedido', async (req, res) => {
    const { idPedido } = req.params;
     if (isNaN(parseInt(idPedido))) {
        return res.status(400).json({ message: 'ID de Pedido inválido.' });
    }
     const numIdPedido = parseInt(idPedido);
    try {
        const query = 'DELETE FROM VENTAS WHERE ID_PEDIDO = @idPedido';
        const params = [{ name: 'idPedido', type: sql.Int, value: numIdPedido }];
        const result = await executeQuery(query, params);

        if (result.rowsAffected[0] > 0) {
             res.json({ message: `Venta con ID Pedido ${numIdPedido} eliminada exitosamente.` });
         } else {
             res.status(404).json({ message: `Venta con ID Pedido ${numIdPedido} no encontrada para eliminar.` });
         }

    } catch (err) {
         console.error("Error detallado al eliminar venta:", err);
        res.status(500).json({ message: `Error interno al eliminar la venta ${idPedido}`, error: err.message });
    }
});


// --- Servir archivos estáticos ---
const publicDirectoryPath = path.join(__dirname, 'public');
app.use(express.static(publicDirectoryPath)); // Servir archivos desde 'public'

// Ruta principal ('/') sirve index.html desde 'public'
app.get('/', (req, res) => {
   res.sendFile(path.join(publicDirectoryPath, 'index.html'));
});

// Ruta para ventas.html (asume que está en 'public')
app.get('/ventas.html', (req, res) => {
    res.sendFile(path.join(publicDirectoryPath, 'ventas.html'));
});

// --- Middleware de Manejo de Errores Genérico (Al final de todo) ---
app.use((err, req, res, next) => {
    console.error("Error no manejado detectado:", err.stack);
    // Evitar enviar detalles del stack al cliente en producción
    const statusCode = err.status || 500;
    const errorMessage = process.env.NODE_ENV === 'production' ? 'Ocurrió un error inesperado en el servidor.' : err.message;
    res.status(statusCode).send({ message: errorMessage, ...(process.env.NODE_ENV !== 'production' && { errorDetail: err.stack }) });
});


// --- Iniciar el servidor ---
app.listen(port, () => {
    console.log(`Servidor backend escuchando en http://localhost:${port}`);
    console.log(`Dashboard accesible en http://localhost:${port}/`);
    console.log(`Gestión de Ventas accesible en http://localhost:${port}/ventas.html`);
});
