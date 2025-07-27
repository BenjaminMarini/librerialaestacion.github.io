const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Servir index.html en la ruta raíz
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Configuración de SQLite
const dbPath = path.join(__dirname, 'productos.db');
const db = new sqlite3.Database(dbPath);

// Crear tabla si no existe
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS productos (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        costo REAL NOT NULL,
        iva REAL NOT NULL,
        precioVenta REAL NOT NULL,
        proveedor TEXT NOT NULL,
        fechaIngreso DATE NOT NULL,
        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fechaModificacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Base de datos SQLite inicializada');
    console.log('✅ Tabla productos verificada/creada');
});

// Obtener todos los productos
app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos ORDER BY fechaCreacion DESC", (err, rows) => {
        if (err) {
            console.error('Error obteniendo productos:', err);
            res.status(500).json({ error: 'Error obteniendo productos' });
        } else {
            res.json(rows);
        }
    });
});

// Buscar productos
app.get('/api/productos/buscar/:termino', (req, res) => {
    const termino = `%${req.params.termino}%`;
    const query = `
        SELECT * FROM productos 
        WHERE nombre LIKE ? 
           OR proveedor LIKE ?
           OR CAST(costo AS TEXT) LIKE ?
           OR CAST(precioVenta AS TEXT) LIKE ?
        ORDER BY fechaCreacion DESC
    `;
    
    db.all(query, [termino, termino, termino, termino], (err, rows) => {
        if (err) {
            console.error('Error buscando productos:', err);
            res.status(500).json({ error: 'Error buscando productos' });
        } else {
            res.json(rows);
        }
    });
});

// Obtener producto por ID
app.get('/api/productos/:id', (req, res) => {
    db.get("SELECT * FROM productos WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('Error obteniendo producto:', err);
            res.status(500).json({ error: 'Error obteniendo producto' });
        } else if (!row) {
            res.status(404).json({ error: 'Producto no encontrado' });
        } else {
            res.json(row);
        }
    });
});

// Crear nuevo producto
app.post('/api/productos', (req, res) => {
    const { id, nombre, costo, iva, precioVenta, proveedor, fechaIngreso } = req.body;
    
    // Validaciones
    if (!nombre || !costo || !iva || !proveedor || !fechaIngreso) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const query = `
        INSERT INTO productos (id, nombre, costo, iva, precioVenta, proveedor, fechaIngreso)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [id, nombre, costo, iva, precioVenta, proveedor, fechaIngreso], function(err) {
        if (err) {
            console.error('Error creando producto:', err);
            if (err.code === 'SQLITE_CONSTRAINT') {
                res.status(400).json({ error: 'Ya existe un producto con ese ID' });
            } else {
                res.status(500).json({ error: 'Error creando producto' });
            }
        } else {
            // Obtener el producto recién creado
            db.get("SELECT * FROM productos WHERE id = ?", [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: 'Error obteniendo producto creado' });
                } else {
                    res.status(201).json(row);
                }
            });
        }
    });
});

// Actualizar producto
app.put('/api/productos/:id', (req, res) => {
    const { nombre, costo, iva, precioVenta, proveedor, fechaIngreso } = req.body;
    const id = req.params.id;

    // Validaciones
    if (!nombre || !costo || !iva || !proveedor || !fechaIngreso) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const query = `
        UPDATE productos 
        SET nombre = ?, costo = ?, iva = ?, precioVenta = ?, 
            proveedor = ?, fechaIngreso = ?, fechaModificacion = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    db.run(query, [nombre, costo, iva, precioVenta, proveedor, fechaIngreso, id], function(err) {
        if (err) {
            console.error('Error actualizando producto:', err);
            res.status(500).json({ error: 'Error actualizando producto' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
        } else {
            // Obtener el producto actualizado
            db.get("SELECT * FROM productos WHERE id = ?", [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: 'Error obteniendo producto actualizado' });
                } else {
                    res.json(row);
                }
            });
        }
    });
});

// Eliminar producto
app.delete('/api/productos/:id', (req, res) => {
    db.run("DELETE FROM productos WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            console.error('Error eliminando producto:', err);
            res.status(500).json({ error: 'Error eliminando producto' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
        } else {
            res.json({ message: 'Producto eliminado exitosamente' });
        }
    });
});

// Estadísticas
app.get('/api/estadisticas', (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as totalProductos,
            AVG(costo) as costoPromedio,
            AVG(precioVenta) as precioVentaPromedio,
            MIN(costo) as costoMinimo,
            MAX(precioVenta) as precioMaximo,
            COUNT(DISTINCT proveedor) as totalProveedores
        FROM productos
    `;
    
    db.get(query, (err, row) => {
        if (err) {
            console.error('Error obteniendo estadísticas:', err);
            res.status(500).json({ error: 'Error obteniendo estadísticas' });
        } else {
            res.json(row);
        }
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('✅ Conectado a SQLite exitosamente');
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Manejo de cierre del servidor
process.on('SIGINT', () => {
    console.log('\n⏹️  Cerrando servidor...');
    db.close((err) => {
        if (err) {
            console.error('Error cerrando base de datos:', err);
        } else {
            console.log('✅ Base de datos cerrada');
        }
        process.exit(0);
    });
});