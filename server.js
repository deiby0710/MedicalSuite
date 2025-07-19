const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql2');
const medicamentosRouter = require('./routes/medicamentos');
const ExcelJS = require('exceljs');
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');

// Ruta para la aplicación "Entregados"
app.use('/entregados', express.static(path.join(__dirname, 'entregados', 'public')));
app.get('/entregados', (req, res) => {
    res.sendFile(path.join(__dirname, 'entregados', 'public', 'index.html'));
});

// Ruta para la aplicación "Pendientes"
app.use('/pendientes', express.static(path.join(__dirname, 'pendientes', 'public')));
app.get('/pendientes', (req, res) => {
    res.sendFile(path.join(__dirname, 'pendientes', 'public', 'index.html'));
});


// Middleware para parsear datos del formulario
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Agregado para parsear JSON si es necesario

// Configuración de la sesión
app.use(session({
    secret: 'mi_secreto', // Cambia esto por una cadena secreta segura
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Cambia a true si usas HTTPS
}));


// Ruta para manejar el login
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    fs.readFile('usuarios.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error leyendo el archivo JSON:', err);
            return res.redirect('/login.html?error=true');
        }

        // Parsear el JSON y buscar el usuario
        const usuarios = JSON.parse(data);
        const usuarioEncontrado = usuarios.find(user => user.username === username && user.password === password);

        if (usuarioEncontrado) {
            // Almacena el nombre de usuario y la sede en la sesión
            req.session.username = usuarioEncontrado.username; // Almacenar el nombre de usuario en la sesión
            req.session.sede = usuarioEncontrado.sede; 
            req.session.role = usuarioEncontrado.role;// Almacenar la sede en la sesión
            // Redirigir a index.html con el nombre de usuario y sede como parámetros de consulta
            res.redirect(`/index.html?username=${encodeURIComponent(usuarioEncontrado.username)}&sede=${encodeURIComponent(usuarioEncontrado.sede)}&role=${encodeURIComponent(usuarioEncontrado.role)}`); 
        } else {
            // Redirigir de vuelta a login.html con un mensaje de error en la URL
            res.redirect('/login.html?error=true');
        }
    });
});


// Ruta para renderizar index.html
app.get('/index.html', (req, res) => {
    // Leer el nombre de usuario de la sesión
    const username = req.session.username || 'Invitado'; // Asegurarse de que la sesión existe
    const sede = req.session.sede || 'Desconocida'; // Obtener sede de la sesión

    // Enviar el archivo index.html y pasar el nombre de usuario y sede a través de la URL
    res.sendFile(path.join(__dirname, 'public', 'index.html'), {
        headers: {
            'username': username, // Esto no se usará en HTML pero puede ser útil para debugging
            'sede': sede
        }
    });
});

// Middleware para manejar JSON en las solicitudes
app.use(express.json());

// Crear conexión con la base de datos MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'medicamentos'
});

// Verificar la conexión a la base de datos
connection.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos: ' + err.stack);
        return;
    }
    console.log('Conectado a la base de datos con el ID ' + connection.threadId);
});

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Pasar la conexión a las rutas
app.use((req, res, next) => {
    req.db = connection;  // Hacer la conexión accesible desde las rutas
    next();
});

// Ruta base para medicamentos
app.use('/api', medicamentosRouter); // Asegúrate de que el prefijo /api esté en uso

app.post('/logout', (req, res) => {
    // Destruir la sesión
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error al cerrar sesión');
        }
        // Eliminar la cookie de sesión
        res.clearCookie('connect.sid'); // Esto limpia la cookie de sesión
        res.sendStatus(200); // Respuesta exitosa
    });
});



app.post('/agregarUsuario', (req, res) => {
    const { nombrecompleto, cedula, username, password, sede, role } = req.body;

    // Validar que todos los campos estén presentes
    if (!nombrecompleto || !cedula || !username || !password || !sede || !role) {
        return res.status(400).send({ message: 'Datos incompletos' });
    }

    // Ruta del archivo JSON
    const filePath = 'usuarios.json';

    // Leer datos existentes del archivo JSON o inicializar un arreglo vacío
    let usuarios = [];
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath);
        usuarios = JSON.parse(fileContent);
    }

    // Agregar el nuevo usuario
    usuarios.push({ nombrecompleto, cedula, username, password, sede, role });

    // Guardar los datos actualizados en el archivo JSON
    fs.writeFileSync(filePath, JSON.stringify(usuarios, null, 2));

    // Responder al cliente
    res.status(200).send({ message: 'Usuario agregado correctamente' });
});


app.post('/validarCedula', (req, res) => {
    const { cedula } = req.body;

    // Validar que la cédula esté presente
    if (!cedula) {
        return res.status(400).send({ message: 'Cédula no proporcionada' });
    }

    // Ruta del archivo JSON
    const filePath = 'usuarios.json';

    // Leer los datos existentes del archivo JSON o inicializar un arreglo vacío
    let usuarios = [];
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath);
        usuarios = JSON.parse(fileContent);
    }

    // Verificar si la cédula ya existe en los usuarios
    const usuarioExistente = usuarios.find(usuario => usuario.cedula === cedula);

    if (usuarioExistente) {
        // Si la cédula ya existe, devolver un mensaje de error
        return res.status(400).send({ message: 'La cédula ya está registrada' });
    }

    // Si no existe, devolver un mensaje de éxito
    res.status(200).send({ message: 'La cédula está disponible' });
});


// Ruta para obtener el usuario por cédula
app.get('/ObtenerUsuario/:cedula', (req, res) => {
    const { cedula } = req.params;

    // Ruta del archivo JSON
    const filePath = 'usuarios.json';

    // Leer los datos existentes del archivo JSON o inicializar un arreglo vacío
    let usuarios = [];
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        usuarios = JSON.parse(fileContent);
    }

    // Buscar el usuario por cédula
    const usuario = usuarios.find(user => user.cedula === cedula);

    if (!usuario) {
        return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    // Enviar los datos del usuario (username y sede) como respuesta
    res.status(200).send({ username: usuario.username, sede: usuario.sede });
});







// Ruta para actualizar la sede de un usuario
app.post('/ActualizarUsuario', (req, res) => {
    const { cedula, sede } = req.body;

    // Validar que la cédula y la sede estén presentes
    if (!cedula || !sede) {
        return res.status(400).send({ message: 'Datos incompletos' });
    }

    // Ruta del archivo JSON
    const filePath = 'usuarios.json';

    // Leer los usuarios del archivo JSON
    let usuarios = [];
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        usuarios = JSON.parse(fileContent);
    }

    // Buscar el usuario por cédula
    const usuarioIndex = usuarios.findIndex(user => user.cedula === cedula);

    if (usuarioIndex === -1) {
        return res.status(404).send({ message: 'Usuario no encontrado' });
    }

    // Actualizar la sede del usuario
    usuarios[usuarioIndex].sede = sede;

    // Guardar los datos actualizados en el archivo JSON
    fs.writeFileSync(filePath, JSON.stringify(usuarios, null, 2));

    // Responder con mensaje de éxito
    res.status(200).send({ message: 'Sede actualizada correctamente', usuario: usuarios[usuarioIndex] });
});


app.post('/agregarMedicamentos', (req, res) => {
    // Destructuramos los datos del cuerpo de la solicitud
    const {nombre, laboratorio, tipo, cobertura, cum } = req.body;
    // Verificar que todos los campos sean proporcionados
    if ( !nombre || !laboratorio || !tipo || !cobertura || !cum) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    // Crear el objeto con los datos recibidos (opcionalmente, se podrían realizar más validaciones)
    const data = {
        nombre,
        laboratorio,
        tipo,
        cobertura,
        cum
    };
    // Definir la consulta SQL para insertar los datos en la base de datos
    const sql = 'INSERT INTO medicamentos (nombre, laboratorio, tipoproducto, cobertura, cum) VALUES (?, ?, ?, ?, ?)';
    // Definir los valores que se insertarán en la base de datos
    const values = [data.nombre, data.laboratorio, data.tipo, data.cobertura, data.cum];
    // Ejecutar la consulta para insertar los datos
    req.db.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error al guardar el medicamento: ', error);
            return res.status(500).json({ message: 'Error al guardar los datos en la base de datos' });
        }
        // Si la inserción es exitosa, respondemos con un mensaje de éxito
        res.status(201).json({ message: 'Medicamento agregado correctamente' });
    });
});

// ----------------------------------PENDIENTES-------------------------------------
app.get('/buscar-pendientes', (req, res) => {
    const identificacion = req.query.identificacion;

    // Primero, consultar en la tabla pacientes
    const queryPacientes = 'SELECT identificacion, tipoidentificacion, nombre, telefono, eps FROM pacientes WHERE identificacion = ?';
    req.db.query(queryPacientes, [identificacion], (err, pacientesResult) => {
        if (err) {
            return res.status(500).json({ message: 'Error en la consulta de pacientes' });
        }

        // Si no se encuentra el paciente
        if (pacientesResult.length === 0) {
            return res.status(404).json({ message: 'Paciente no encontrado' });
        }

        // Si se encuentra el paciente, consultar en la tabla pendientes
        const queryPendientes = 'SELECT idpendientes, numerofactura, fecharegistro, celular, celular2, direccion, medicamento, tipoentrega, sedependiente, cantidadprescrita, cantidadpendiente, cantidadpendientefinal, fechaformula, laboratorio, observacion FROM pendientes WHERE identificacion = ?';
        req.db.query(queryPendientes, [identificacion], (err, pendientesResult) => {
            if (err) {
                return res.status(500).json({ message: 'Error en la consulta de pendientes' });
            }
            // Enviar los resultados de pacientes y pendientes
            res.json({ paciente: pacientesResult[0], pendientes: pendientesResult });
        });
    });
});

// Ruta para actualizar la cantidad entregada
app.post('/api/actualizar-cantidad-entregada', (req, res) => {
    const updates = req.body.updates; // Capturar los datos enviados desde el frontend

    const sql = `UPDATE pendientes SET cantidadentregada = cantidadentregada + ?, cantidadpendientefinal = ? WHERE idpendientes = ?`;

    // Usar promesas para asegurarse de que todas las actualizaciones se realicen
    const promises = updates.map(update => {
        return new Promise((resolve, reject) => {
            connection.query(sql, [update.cantidadentregada, update.cantidadpendientefinal,update.idpendientes], (err, result) => {
                if (err) {
                    console.error('Error al actualizar los datos:', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    });

    Promise.all(promises)
        .then(() => {
            res.json({ success: true });
        })
        .catch(() => {
            res.json({ success: false });
        });
});

// Ruta para actualizar la observacion del pendiente
app.post('/api/actualizar-observacion-pendiente', (req, res) => {
    const updates = req.body.updates; // Capturar los datos enviados desde el frontend

    const sql = `UPDATE pendientes SET observacion = ? WHERE idpendientes = ?;`;

    // Usar promesas para asegurarse de que todas las actualizaciones se realicen
    const promises = updates.map(update => {
        // console.log(mysql.format(sql, [update.observacion,update.idpendientes]));
        return new Promise((resolve, reject) => {
            connection.query(sql, [update.observacion,update.idpendientes], (err, result) => {
                if (err) {
                    console.error('Error al actualizar las observaciones:', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    });

    Promise.all(promises)
        .then(() => {
            res.json({ success: true });
        })
        .catch(() => {
            res.json({ success: false });
        });
});

app.post('/actualizar-cantidad', (req, res) => {
    const { cantidadentregada, idpendientes, username, facturaSI } = req.body;
    
    // Validación de los datos recibidos
    if (!cantidadentregada || !idpendientes || !username ) {
        return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    const fechaActual = new Date(); // Obtener la fecha actual

    // Lógica para buscar en la base de datos según numerofactura y medicamento
    const query = 'SELECT * FROM pendientes WHERE idpendientes = ?';

    req.db.query(query, [idpendientes], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ message: 'Error al consultar la base de datos' });
        }

        // Si no se encuentra el registro
        if (results.length === 0) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }

        const registro = results[0];
        let totalEntregas = 0;

        // Comprobar cuántas entregas ya existen en el registro
        for (let i = 1; i <= 6; i++) {
            if (registro[`cantidadentregada${i}`]) {
                totalEntregas++;
            }
        }

        // Verificar si ya hay 6 entregas y si se intenta hacer la séptima
        if (totalEntregas >= 4) {
            return res.status(400).json({ message: 'Se han alcanzado el máximo de 6 entregas. No se pueden agregar más.' });
        }

        // Actualiza la cantidad entregada y la fecha en la tabla
        for (let i = 1; i <= 6; i++) {
            // Comprobar si la cantidad entregada está vacía
            if (!registro[`cantidadentregada${i}`] && registro[`cantidadentregada${i}`] !== 0) {
                registro[`cantidadentregada${i}`] = cantidadentregada; // Establecer nueva cantidad
                registro[`fechaentrega${i}`] = fechaActual; // Establecer la fecha actual
                registro[`entrega${i}`] = username; // Establecer el usuario que realizó la entrega
                registro[`facturaSI${i}`] = facturaSI; // Establecer la factura de Salud IPS
                break;
            }
        }
        // Guarda el registro actualizado en la base de datos
        const updateQuery = 'UPDATE pendientes SET ? WHERE idpendientes = ?';
        req.db.query(updateQuery, [registro, idpendientes], (updateError) => {
            if (updateError) {
                console.error(updateError);
                return res.status(500).json({ message: 'Error al actualizar la cantidad' });
            }
            res.json({ message: 'Cantidad y fecha actualizadas exitosamente' });
        });
    });
});

app.post('/eliminar-cantidad-pendiente', (req, res) => {
    const { id, indice } = req.body;

    // Validación de datos recibidos
    if (!id || !indice) {
        return res.status(400).json({ message: 'Faltan datos requeridos: id o indice' });
    }

    // Generar el nombre de la columna dinámicamente
    const columnName = `cantidadentregada${indice}`;

    const dateQuery = `SELECT ${columnName}, cantidadpendientefinal, cantidadentregada FROM pendientes WHERE idpendientes = ?`;

    req.db.query(dateQuery, [id], (selectError, results) => {
        if (selectError) {
            console.error('Error al consultar el registro:', selectError);
            return res.status(500).json({ message: 'Error al consultar el registro' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }
        const valorCantidadEliminada = results[0][columnName] || 0; // Valor actual de la columna dinámica
        const pendienteFinal = results[0].cantidadpendientefinal || 0;
        const cantidadEntregada = results[0].cantidadentregada || 0;
        
        const nuevaPendienteFinal = pendienteFinal + valorCantidadEliminada;
        const nuevaCantidadEntregada = cantidadEntregada - valorCantidadEliminada;
        const updateQuery = `
            UPDATE pendientes 
            SET ${columnName} = 0, cantidadpendientefinal = ?, cantidadentregada = ? 
            WHERE idpendientes = ?
        `;
        req.db.query(updateQuery, [nuevaPendienteFinal, nuevaCantidadEntregada, id], (updateError, updateResult) => {
            if (updateError) {
                console.error('Error al actualizar el registro:', updateError);
                return res.status(500).json({ message: 'Error al actualizar el registro' });
            }

            if (updateResult.affectedRows === 0) {
                return res.status(404).json({ message: 'Registro no encontrado' });
            }

            res.json({ message: 'Registro actualizado exitosamente' });
        })
    })
});


app.get('/ultima-entrega/:id', (req, res) => {
    const { id } = req.params; // Capturar el parámetro id desde la URL

    if (!id) {
        return res.status(400).json({ message: 'Falta el parámetro requerido: id' });
    }

    const query = 'SELECT * FROM pendientes WHERE idpendientes = ?'; // Buscar por idpendientes
    req.db.query(query, [id], (error, results) => {
        if (error) {
            console.error('Error al consultar la base de datos:', error);
            return res.status(500).json({ message: 'Error al consultar la base de datos' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }

        const registro = results[0];
        let ultimaEntrega = 0;

        for (let i = 1; i <= 6; i++) {
            if (registro[`cantidadentregada${i}`]) {
                ultimaEntrega = i; // Actualizar con el número de la columna que tiene datos
            }
        }

        if (ultimaEntrega === 0) {
            return res.status(200).json({ message: 'No se ha realizado ninguna entrega', ultimaEntrega });
        }

        res.json({ultimaEntrega });
    });
});

// Llamar cantidad pendiente final
// Ruta para obtener el valor actualizado de 'cantidadpendientefinal'
app.get('/api/obtener-cantidad-pendiente', (req, res) => {
    const idpendientes = req.query.idpendientes;

    // Realiza una consulta a la base de datos para obtener el valor actualizado
    const query = 'SELECT cantidadpendientefinal FROM pendientes WHERE idpendientes = ?';
    connection.query(query, [idpendientes], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Error al obtener el valor actualizado' });
        }

        if (results.length > 0) {
            res.json({ cantidadpendientefinal: results[0].cantidadpendientefinal });
        } else {
            res.status(404).json({ error: 'Factura no encontrada' });
        }
    });
});

// Ruta para generar reporte por fecha
app.get('/generar-reporte-hoy-pendientes', (req, res) => {
    // if (req.session.role !== 'admin' && req.session.role !== 'superUser') {
    //     return res.status(403).json({ error: 'Acceso denegado. Solo los administradores y super usuarios pueden generar reportes.' });
    // }
  
    // Obtener las fechas de la consulta
    const { fechaActual } = req.query;
    
    // Consulta SQL para obtener datos dentro del rango de fechas
    const query = `
    SELECT idpendientes, numerofactura, fecharegistro,identificacion, tipoidentificacion, nombre, eps, celular, celular2, direccion,
    medicamento, tipoproducto, laboratorio, cantidadprescrita, cantidadpendiente, cantidadentregada, cantidadpendientefinal, controlmensual,
    tipoentrega, sedependiente, estadodispensacion, numeroformula, cum, nitips,nombreips, codigodiagnostico, diagnostico, fechaformula, observacion,registradopor 
    FROM pendientes WHERE fecharegistro = ?;
`;

    connection.query(query, [fechaActual], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Error al obtener los datos de la base de datos' });
        }

        // Crear un nuevo libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Pendientes');
        // Agregar encabezados
        worksheet.columns = [
            { header: 'idpendientes', key: 'idpendientes', width: 15 },
            { header: 'numerofactura', key: 'numerofactura', width: 15 },
            { header: 'fecharegistro', key: 'fecharegistro', width: 20 },
            { header: 'identificacion', key: 'identificacion', width: 15 },
            { header: 'tipoidentificacion', key: 'tipoidentificacion', width: 20 },
            { header: 'nombre', key: 'nombre', width: 30 },
            { header: 'eps', key: 'eps', width: 30 },
            { header: 'celular', key: 'celular', width: 15 },
            { header: 'celular2', key: 'celular2', width: 15 },
            { header: 'direccion', key: 'direccion', width: 30 },
            { header: 'medicamento', key: 'medicamento', width: 30 },
            { header: 'tipoproducto', key: 'tipoproducto', width: 20 },
            { header: 'laboratorio', key: 'laboratorio', width: 20 },
            // { header: 'cobertura', key: 'cobertura', width: 15 },
            { header: 'cantidadprescrita', key: 'cantidadprescrita', width: 20 },
            { header: 'cantidadpendiente', key: 'cantidadpendiente', width: 20 },
            { header: 'cantidadentregada', key: 'cantidadentregada', width: 20 },
            // { header: 'cantidadentregada1', key: 'cantidadentregada1', width: 20 },
            // { header: 'fechaentrega1', key: 'fechaentrega1', width: 20 },
            // { header: 'entrega1', key: 'entrega1', width: 20 },
            // { header: 'cantidadentregada2', key: 'cantidadentregada2', width: 20 },
            // { header: 'fechaentrega2', key: 'fechaentrega2', width: 20 },
            // { header: 'entrega2', key: 'entrega2', width: 20 },
            // { header: 'cantidadentregada3', key: 'cantidadentregada3', width: 20 },
            // { header: 'fechaentrega3', key: 'fechaentrega3', width: 20 },
            // { header: 'entrega3', key: 'entrega3', width: 20 },
            // { header: 'cantidadentregada4', key: 'cantidadentregada4', width: 20 },
            // { header: 'fechaentrega4', key: 'fechaentrega4', width: 20 },
            // { header: 'entrega4', key: 'entrega4', width: 20 },
            // { header: 'cantidadentregada5', key: 'cantidadentregada5', width: 20 },
            // { header: 'fechaentrega5', key: 'fechaentrega5', width: 20 },
            // { header: 'entrega5', key: 'entrega5', width: 20 },
            // { header: 'cantidadentregada6', key: 'cantidadentregada6', width: 20 },
            // { header: 'fechaentrega6', key: 'fechaentrega6', width: 20 },
            // { header: 'entrega6', key: 'entrega6', width: 20 },
            { header: 'cantidadpendientefinal', key: 'cantidadpendientefinal', width: 25 },
            { header: 'controlmensual', key: 'controlmensual', width: 25 },
            { header: 'tipoentrega', key: 'tipoentrega', width: 15 },
            { header: 'sedependiente', key: 'sedependiente', width: 15 },
            { header: 'estadodispensacion', key: 'estadodispensacion', width: 20 },
            { header: 'numeroformula', key: 'numeroformula', width: 20 },
            { header: 'cum', key: 'cum', width: 20 },
            // { header: 'ambito', key: 'ambito', width: 15 },
            { header: 'nitips', key: 'nitips', width: 15 },
            { header: 'nombreips', key: 'nombreips', width: 30 },
            // { header: 'modalidad', key: 'modalidad', width: 20 },
            { header: 'codigodiagnostico', key: 'codigodiagnostico', width: 20 },
            { header: 'diagnostico', key: 'diagnostico', width: 30 },
            // { header: 'plansos', key: 'plansos', width: 20 },
            { header: 'fechaformula', key: 'fechaformula', width: 20 },
            { header: 'observacion', key: 'observacion', width: 30 },
            { header: 'registradopor', key: 'registradopor', width: 30 }
        ];
        

         // Agregar los datos de la base de datos
       results.forEach((row) => {
        worksheet.addRow(row);
    });

    // Guardar el archivo Excel temporalmente en el servidor
    const filePath = path.join(__dirname, 'reporte_fechas.xlsx');
    workbook.xlsx.writeFile(filePath)
        .then(() => {
            // Enviar el archivo Excel al cliente
            res.download(filePath, 'reporte_fechas.xlsx', (err) => {
                if (err) {
                    console.error('Error al descargar el archivo:', err);
                }

                // Eliminar el archivo temporal después de enviarlo
                fs.unlinkSync(filePath);
            });
        })
        .catch((error) => {
            console.error('Error al generar el archivo Excel:', error);
            res.status(500).json({ error: 'Error al generar el archivo Excel' });
        });
});
});
app.post('/generar-reporte-CyS-pendientes', (req, res) => {
    // Obtener las fechas de la consulta
    const { fechaInicio, fechaFin, eps } = req.body;

    if (!fechaInicio || !fechaFin || !eps) {
        return res.status(400).json({ error: 'Debes enviar fechaInicio, fechaFin y eps' });
        }
    
    // Consulta SQL para obtener datos dentro del rango de fechas
    const query = `
    SELECT idpendientes, numerofactura, fecharegistro,identificacion, tipoidentificacion, nombre, eps, celular, celular2, direccion,
    medicamento, tipoproducto, laboratorio, cantidadprescrita, cantidadpendiente, cantidadentregada, cantidadpendientefinal, controlmensual,
    tipoentrega, sedependiente, estadodispensacion, numeroformula, cum, nitips,nombreips, codigodiagnostico, diagnostico, fechaformula, observacion,registradopor 
    FROM pendientes WHERE fecharegistro BETWEEN ? AND ? AND eps = ?;
`;

    connection.query(query, [fechaInicio, fechaFin, eps], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Error al obtener los datos de la base de datos' });
        }

        // Crear un nuevo libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Pendientes');
        // Agregar encabezados
        worksheet.columns = [
            { header: 'nombre', key: 'nombre', width: 30 },
            { header: 'tipoidentificacion', key: 'tipoidentificacion', width: 20 },
            { header: 'identificacion', key: 'identificacion', width: 15 },
            { header: 'celular', key: 'celular', width: 15 },
            { header: 'diagnostico', key: 'diagnostico', width: 15 },
            { header: 'modalidad', key: 'modalidad', width: 15 },
            { header: 'cum', key: 'cum', width: 20 },
            { header: 'medicamento', key: 'medicamento', width: 30 },
            { header: 'cantidadprescrita', key: 'cantidadprescrita', width: 20 },
            { header: 'cantidadentregada', key: 'cantidadentregada', width: 20 },
            { header: 'cantidadpendiente', key: 'cantidadpendiente', width: 20 },
            { header: 'fecharegistro', key: 'fecharegistro', width: 20 },
            { header: 'observacion', key: 'observacion', width: 30 }
        ];
        

         // Agregar los datos de la base de datos
       results.forEach((row) => {
        worksheet.addRow(row);
    });

    // Guardar el archivo Excel temporalmente en el servidor
    const filePath = path.join(__dirname, 'reporte_CyS.xlsx');
    workbook.xlsx.writeFile(filePath)
        .then(() => {
            // Enviar el archivo Excel al cliente
            res.download(filePath, 'reporte_CyS.xlsx', (err) => {
                if (err) {
                    console.error('Error al descargar el archivo:', err);
                }

                // Eliminar el archivo temporal después de enviarlo
                fs.unlinkSync(filePath);
            });
        })
        .catch((error) => {
            console.error('Error al generar el archivo Excel:', error);
            res.status(500).json({ error: 'Error al generar el archivo Excel' });
        });
});
});


// Ruta para descargar el archivo Excel (solo uno)
const EXCEL_FILE_PENDIENTES = path.join(__dirname, 'Pendientes', 'reportes', 'reporte_pendientes.xlsx'); // Nombre del único archivo Excel

app.get('/descargar-pendientes', (req, res) => {
    // Verifica que el archivo exista antes de enviarlo
    if (fs.existsSync(EXCEL_FILE_PENDIENTES)) {
        res.download(EXCEL_FILE_PENDIENTES, 'reporte_pendientes.xlsx', (err) => {
            if (err) {
                console.error('Error al descargar el archivo:', err);
                res.status(500).send('Error al descargar el archivo.');
            }
        });
    } else {
        res.status(404).send('Archivo no encontrado.');
    }
});


// -----------------------------------ENTREGADOS--------------------------------------
app.get('/buscar-entregado', (req, res) => {
    const identificacion = req.query.identificacion;

    // Primero, consultar en la tabla pacientes
    const queryPacientes = 'SELECT identificacion, tipoidentificacion, nombre, telefono, eps FROM pacientes WHERE identificacion = ?';
    req.db.query(queryPacientes, [identificacion], (err, pacientesResult) => {
        if (err) {
            return res.status(500).json({ message: 'Error en la consulta de pacientes' });
        }

        // Si no se encuentra el paciente
        if (pacientesResult.length === 0) {
            return res.status(404).json({ message: 'Paciente no encontrado' });
        }

        // Si se encuentra el paciente, consultar en la tabla pendientes
        const queryPendientes = 'SELECT DISTINCT numerodelentregado, fecharegistro, sede FROM entregados WHERE identificacion = ?';
        req.db.query(queryPendientes, [identificacion], (err, pendientesResult) => {
            if (err) {
                return res.status(500).json({ message: 'Error en la consulta de pendientes' });
            }
            // Enviar los resultados de pacientes y pendientes
            res.json({ paciente: pacientesResult[0], pendientes: pendientesResult});
        });
    });
});

app.get('/mostrar-entregado', (req, res) => {
    const { numerodelentregado, identificacion } = req.query;
        const queryPendientes = 'SELECT nombregenerico, laboratorio, nombrecomercial, formafarmaceutica, fechavencimiento, lote, cantidaddispensada, fecharegistro, municipio, copago_cuota, valorcopago_cuota, rango, fechaformula, numeroformula, codigodiagnostico, diagnostico, codigomipres, numeroautorizacion, regimen, modalidad, autorizacionmipres, validacionpgp, observacion, registradopor, sede, cantidadprescrita, npendiente FROM entregados WHERE numerodelentregado = ? and identificacion = ?';
        req.db.query(queryPendientes, [numerodelentregado, identificacion], (err, entregadosResult) => {
            if (err) {
                return res.status(500).json({ message: 'Error en la consulta de pendientes' });
            }
            // Enviar los resultados de pacientes y pendientes
            res.json({ entregados: entregadosResult});
        });
    });

    // Ruta para generar reporte por fecha
    app.get('/generar-reporte-hoy-entregados', (req, res) => {
      
        // Obtener las fechas de la consulta
        const { fechaActual } = req.query;
        
        // Consulta SQL para obtener datos dentro del rango de fechas
        const query = `
            SELECT identregados, numerodelentregado, fecharegistro, diasEntrega, identificacion, tipoidentificacion, nombre, eps, celular, municipio, modalidad, autorizacionmipres, codigomipres, numeroautorizacion, validacionpgp, regimen, copago_cuota, valorcopago_cuota, rango, fechaformula, numeroformula, codigodiagnostico, diagnostico, nombregenerico, laboratorio, lote,fechavencimiento, cantidadprescrita, cantidaddispensada, observacion, sede, registradopor FROM entregados
            WHERE DATE(fecharegistro) = ?
        `;
    
        connection.query(query, [fechaActual], (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Error al obtener los datos de la base de datos' });
            }
    
            // Crear un nuevo libro de Excel
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Reporte Entregados');
    
            // Agregar encabezados
            worksheet.columns = [
                { header: 'identregados', key: 'identregados', width: 15 },
                { header: 'numerodelentregado', key: 'numerodelentregado', width: 15 },
                { header: 'fecharegistro', key: 'fecharegistro', width: 20 },
                { header: 'diasEntrega', key: 'diasEntrega', width: 20 },
                { header: 'identificacion', key: 'identificacion', width: 15 },
                { header: 'tipoidentificacion', key: 'tipoidentificacion', width: 15 },
                { header: 'nombre', key: 'nombre', width: 30 },
                { header: 'eps', key: 'eps', width: 30 },
                { header: 'celular', key: 'celular', width: 15 },
                { header: 'municipio', key: 'municipio', width: 30 },
                { header: 'modalidad', key: 'modalidad', width: 20 },
                { header: 'autorizacionmipres', key: 'autorizacionmipres', width: 20 },
                { header: 'codigomipres', key: 'codigomipres', width: 20 },
                { header: 'numeroautorizacion', key: 'numeroautorizacion', width: 20 },
                { header: 'validacionpgp', key: 'validacionpgp', width: 20 },
                { header: 'regimen', key: 'regimen', width: 20 },
                { header: 'copago_cuota', key: 'copago_cuota', width: 20 },
                { header: 'valorcopago_cuota', key: 'valorcopago_cuota', width: 20 },
                { header: 'rango', key: 'rango', width: 15 },
                { header: 'fechaformula', key: 'fechaformula', width: 20 },
                { header: 'numeroformula', key: 'numeroformula', width: 20 },
                { header: 'codigodiagnostico', key: 'codigodiagnostico', width: 20 },
                { header: 'diagnostico', key: 'diagnostico', width: 30 },
                { header: 'nombregenerico', key: 'nombregenerico', width: 30 },
                { header: 'laboratorio', key: 'laboratorio', width: 30 },
                { header: 'lote', key: 'lote', width: 30 },
                { header: 'fechavencimiento', key: 'fechavencimiento', width: 15 },
                { header: 'cantidadprescrita', key: 'cantidadprescrita', width: 20 },
                { header: 'cantidaddispensada', key: 'cantidaddispensada', width: 20 },
                { header: 'observacion', key: 'observacion', width: 20 },
                { header: 'sede', key: 'sede', width: 20 },
                { header: 'registradopor', key: 'registradopor', width: 20 }
            ];
    
           // Agregar los datos de la base de datos
           results.forEach((row) => {
            worksheet.addRow(row);
        });
    
        // Guardar el archivo Excel temporalmente en el servidor
        const filePath = path.join(__dirname, 'reporte_fechas.xlsx');
        workbook.xlsx.writeFile(filePath)
            .then(() => {
                // Enviar el archivo Excel al cliente
                res.download(filePath, 'reporte_fechas.xlsx', (err) => {
                    if (err) {
                        console.error('Error al descargar el archivo:', err);
                    }
    
                    // Eliminar el archivo temporal después de enviarlo
                    fs.unlinkSync(filePath);
                });
            })
            .catch((error) => {
                console.error('Error al generar el archivo Excel:', error);
                res.status(500).json({ error: 'Error al generar el archivo Excel' });
            });
    });
});


    app.post('/mover-a-reciclaje-entregados', (req, res) => {
        const {username, numerodelentregado, identificacion } = req.body;
    
        const queryInsert = `
            INSERT INTO reciclaje_entregados (
                identregados, numerodelentregado, fecharegistro, identificacion, tipoidentificacion, nombre, celular, eps, municipio, modalidad, autorizacionmipres, codigomipres, numeroautorizacion, validacionpgp, regimen, copago_cuota, valorcopago_cuota, rango, fechaformula, numeroformula, codigodiagnostico, diagnostico, sede,  nombregenerico,
                laboratorio, nombrecomercial, formafarmaceutica, fechavencimiento, lote, cantidadprescrita, cantidaddispensada, observacion, registradopor, npendiente, eliminadopor
            )
            SELECT 
                identregados, numerodelentregado, fecharegistro, identificacion, tipoidentificacion, nombre, celular, eps, municipio, modalidad, autorizacionmipres, codigomipres, numeroautorizacion, validacionpgp, regimen, copago_cuota, valorcopago_cuota, rango, fechaformula, numeroformula, codigodiagnostico, diagnostico, sede,  nombregenerico,
                laboratorio, nombrecomercial, formafarmaceutica, fechavencimiento, lote, cantidadprescrita, cantidaddispensada, observacion, registradopor, npendiente, ?
            FROM entregados
            WHERE numerodelentregado = ?
            AND identificacion = ?;
        `;
    
        const queryDelete = `
            DELETE FROM entregados
            WHERE numerodelentregado = ?
            AND identificacion = ?;
        `;
    
        req.db.beginTransaction((error) => {
            if (error) {
                return res.status(500).json({ message: 'Error al iniciar la transacción' });
            }
    
            // Desactivar SQL_SAFE_UPDATES
            req.db.query('SET SQL_SAFE_UPDATES = 0;', (error) => {
                if (error) {
                    return req.db.rollback(() => {
                        console.error('Error al desactivar SQL_SAFE_UPDATES:', error);
                        res.status(500).json({ message: 'Error al modificar SQL_SAFE_UPDATES' });
                    });
                }
    
                req.db.query(queryInsert, [username, numerodelentregado, identificacion], (error, results) => {
                    if (error) {
                        return req.db.rollback(() => {
                            console.error('Error al insertar en reciclaje:', error);
                            res.status(500).json({ message: 'Error al mover los datos a la tabla de reciclaje' });
                        });
                    }
    
                    req.db.query(queryDelete, [numerodelentregado, identificacion], (error, results) => {
                        if (error) {
                            return req.db.rollback(() => {
                                console.error('Error al eliminar de entregados:', error);
                                res.status(500).json({ message: 'Error al eliminar los registros de la tabla entregados' });
                            });
                        }
    
                        // Restaurar SQL_SAFE_UPDATES
                        req.db.query('SET SQL_SAFE_UPDATES = 1;', (error) => {
                            if (error) {
                                return req.db.rollback(() => {
                                    console.error('Error al restaurar SQL_SAFE_UPDATES:', error);
                                    res.status(500).json({ message: 'Error al restaurar SQL_SAFE_UPDATES' });
                                });
                            }
    
                            req.db.commit((error) => {
                                if (error) {
                                    return req.db.rollback(() => {
                                        console.error('Error al hacer commit:', error);
                                        res.status(500).json({ message: 'Error al confirmar la transacción' });
                                    });
                                }
    
                                res.status(200).json({
                                    success: true,
                                    message: 'Registros movidos y eliminados correctamente'
                                });
                            });
                        });
                    });
                });
            });
        });
    });


    app.post('/mover-a-reciclaje-pendientes', (req, res) => {
        const { username, id, razon } = req.body;  // El id del registro a mover

        console.log("Motivo eliminacion: ", razon)
    
        // Query para copiar el registro de la tabla 'pendientes' a 'reciclaje_pendientes'
        const queryInsert = `
            INSERT INTO reciclaje_pendientes (
            idpendientes, numerofactura, fecharegistro, identificacion, tipoidentificacion, nombre, eps, celular, celular2, 
            direccion, medicamento, tipoproducto, laboratorio, cobertura,cantidadprescrita, cantidadpendiente, cantidadentregada, 
            cantidadentregada1, fechaentrega1, entrega1, facturaSI1, cantidadentregada2, fechaentrega2, entrega2, facturaSI2, cantidadentregada3, 
            fechaentrega3, entrega3, facturaSI3, cantidadentregada4, fechaentrega4, entrega4, facturaSI4, cantidadpendientefinal, controlmensual, tipoentrega, sedependiente, estadodispensacion, 
            numeroformula, cum, ambito, nitips, nombreips, modalidad, codigodiagnostico,diagnostico, plansos,fechaformula, observacion,
            registradopor, eliminadopor, motivoeliminacion
            )
            SELECT 
            idpendientes, numerofactura, fecharegistro, identificacion, tipoidentificacion, nombre, eps, celular, celular2, direccion, medicamento, 
            tipoproducto, laboratorio, cobertura,cantidadprescrita, cantidadpendiente, cantidadentregada, cantidadentregada1, fechaentrega1, entrega1, facturaSI1,
            cantidadentregada2, fechaentrega2, entrega2, facturaSI2,
            cantidadentregada3, fechaentrega3, entrega3, facturaSI3, cantidadentregada4, fechaentrega4, entrega4, facturaSI4,
            cantidadpendientefinal, controlmensual, tipoentrega, sedependiente, 
            estadodispensacion, numeroformula, cum, ambito, nitips, nombreips, modalidad, codigodiagnostico,diagnostico, plansos,fechaformula, observacion,
            registradopor, ?, ?
            FROM pendientes
            WHERE idpendientes = ?;
        `;
    
        // Query para eliminar el registro de la tabla 'pendientes'
        const queryDelete = `
            DELETE FROM pendientes
            WHERE idpendientes = ?;
        `;
    
        // Iniciar una transacción
        req.db.beginTransaction((error) => {
            if (error) {
                return res.status(500).json({ message: 'Error al iniciar la transacción' });
            }
    
            // Realizar la inserción en 'reciclaje_pendientes'
            req.db.query(queryInsert, [username,razon, id ], (error, results) => {
                if (error) {
                    return req.db.rollback(() => {
                        console.error('Error al insertar en reciclaje:', error);
                        res.status(500).json({ message: 'Error al mover el registro a reciclaje_pendientes' });
                    });
                }
    
                // Eliminar el registro de la tabla 'pendientes'
                req.db.query(queryDelete, [id], (error, results) => {
                    if (error) {
                        return req.db.rollback(() => {
                            console.error('Error al eliminar de pendientes:', error);
                            res.status(500).json({ message: 'Error al eliminar el registro de pendientes' });
                        });
                    }
    
                    // Confirmar la transacción si todo va bien
                    req.db.commit((error) => {
                        if (error) {
                            return req.db.rollback(() => {
                                console.error('Error al hacer commit:', error);
                                res.status(500).json({ message: 'Error al confirmar la transacción' });
                            });
                        }
    
                        res.status(200).json({
                            success: true,
                            message: 'Pendiente eliminado correctamente'
                        });
                    });
                });
            });
        });
    });
    

// Ruta para descargar el archivo Excel (solo uno)
const EXCEL_FILE = path.join(__dirname, 'Entregados', 'reportes', 'reporte_entregados.xlsx'); // Nombre del único archivo Excel

app.get('/descargar-entregados', (req, res) => {
    // Verifica que el archivo exista antes de enviarlo
    if (fs.existsSync(EXCEL_FILE)) {
        res.download(EXCEL_FILE, 'reporte_entregados.xlsx', (err) => {
            if (err) {
                console.error('Error al descargar el archivo:', err);
                res.status(500).send('Error al descargar el archivo.');
            }
        });
    } else {
        res.status(404).send('Archivo no encontrado.');
    }
});
// ------------------------------ FIN ENTREGADOS ---------------------------------------------

    // Iniciar el servidor
app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto http://localhost:3000/login.html');
});