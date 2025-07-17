const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs'); // Importa el módulo fs

// Ruta para buscar paciente por identificación
// used by: entregados y pendientes
router.get('/paciente', (req, res) => {
    const numeroIdentificacion = req.query.numeroIdentificacion;

    // Consulta SQL para buscar el paciente
    const query = `
        SELECT tipoidentificacion, nombre,telefono, eps
        FROM pacientes 
        WHERE identificacion = ?;
    `;

    req.db.query(query, [numeroIdentificacion], (err, results) => {
        if (err) {
            console.error('Error en la consulta: ' + err);
            return res.status(500).json({ error: 'Error en la consulta' });
        }

        if (results.length > 0) {
            const paciente = results[0];
            res.json({
                tipoIdentificacion: paciente.tipoidentificacion,
                primerNombre: paciente.nombre,
                telefono: paciente.telefono,
                eps: paciente.eps
            });
        } else {
            res.status(404).json({ error: 'Paciente no encontrado' });
        }
    });
});

// Backend diagnostico
router.get('/diagnostico', (req, res) => {
    const idDiagnostico = req.query.codigo;

    // Consulta SQL para buscar el diagnóstico
    const query = `
        SELECT nombre
        FROM diagnostico
        WHERE codigo = ?;
    `;

    req.db.query(query, [idDiagnostico], (err, results) => {
        if (err) {
            console.error('Error en la consulta: ' + err);
            return res.status(500).json({ error: 'Error en la consulta' });
        }

        if (results.length > 0) {
            const diagnostico = results[0];
            res.json({
                nombre: diagnostico.nombre // Devuelve el nombre del diagnóstico
            });
        } else {
            res.status(404).json({ error: 'Diagnóstico no encontrado' });
        }
    });
});


// Ruta para obtener la lista de medicamentos
// Used by: Entregados y pendientes
router.get('/medicamentos/nombres', (req, res) => {
    const db = req.db;
    db.query('SELECT nombre FROM medicamentos', (err, results) => {
        if (err) {
            console.error('Error al consultar nombres de medicamentos: ' + err.stack);
            res.status(500).json({ error: 'Error al consultar nombres de medicamentos' });
            return;
        }
        res.json(results.map(row => row.nombre)); // Devuelve solo un arreglo con los nombres
    });
});

// Ruta para obtener la lista de municipios con departamento
router.get('/municipios/nombres', (req, res) => {
    const db = req.db;
    
    db.query('SELECT municipio, departamento FROM municipios', (err, results) => {
        if (err) {
            console.error('Error al consultar nombres de municipios: ' + err.stack);
            return res.status(500).json({ error: 'Error al consultar nombres de municipios' });
        }

        // Devuelve un array con el formato "municipio (departamento)"
        res.json(results.map(row => `${row.municipio} (${row.departamento})`));
    });
});


router.get('/medicamentos/detalles', (req, res) => {
    const db = req.db;
    const nombreMedicamento = req.query.nombre;
    db.query(
        'SELECT laboratorio, tipoproducto, cobertura, cum FROM medicamentos WHERE nombre = ?',
        [nombreMedicamento],
        (err, results) => {
            if (err) {
                console.error('Error al consultar detalles del medicamento: ' + err.stack);
                res.status(500).json({ error: 'Error al consultar detalles del medicamento' });
                return;
            }
            if (results.length === 0) {
                res.status(404).json({ error: 'Medicamento no encontrado' });
                return;
            }
            res.json(results[0]); // Devuelve el primer resultado encontrado
        }
    );
});


router.get('/sedes', (req, res) => {
    const db = req.db;
    db.query('SELECT nombresede FROM sedes', (err, results) => {
        if (err) {
            console.error('Error al consultar sedes: ' + err.stack);
            res.status(500).json({ error: 'Error al consultar sedes' });
            return;
        }
        res.json(results);
    });
});

router.get('/', (req, res) => {
    res.send('El enrutador de medicamentos está funcionando');
});

// Ruta para manejar la inserción de datos
router.post('/pendientes', (req, res) => {
    const {
        fecharegistro, identificacion, tipoidentificacion, nombre, medicamento, cantidadpendiente, numerofactura,
        controlmensual, tipoproducto, cobertura, cantidadprescrita, tipoentrega, sedependiente, estadodispensacion,
        cum, observacion, numeroformula, celular, celular2, direccion, ambito, nitips, nombreips,
        modalidad, codigodiagnostico, diagnostico, plansos, fechaformula, laboratorio,eps, registradopor
    } = req.body;

    // Verificar campos obligatorios
    if (!fecharegistro || !identificacion || !nombre) {
        return res.status(400).json({ message: 'Los campos fecharegistro, identificacion y nombre son requeridos' });
    }

    // Crear un objeto con los datos, omitiendo los campos no proporcionados
    const data = {
        fecharegistro: fecharegistro || null,
        identificacion,
        tipoidentificacion: tipoidentificacion || null,
        nombre,
        medicamento: medicamento || null,
        cantidadpendiente: cantidadpendiente || null,
        cantidadpendientefinal: cantidadpendiente || null,
        controlmensual: controlmensual || null,
        numerofactura: numerofactura || 1, // Valor temporal
    
        // Nuevos campos
        tipoproducto: tipoproducto || null,
        cobertura: cobertura || null,
        cantidadprescrita: cantidadprescrita || null,
        tipoentrega: tipoentrega || null,
        sedependiente: sedependiente || null,
        estadodispensacion: estadodispensacion || null,
        cum: cum || null,
        observacion: observacion || null,
        numeroformula: numeroformula || null,
        celular: celular || null,
        celular2: celular2 || null,
        direccion: direccion || null,
        ambito: ambito || null,
        nitips: nitips || null,
        nombreips: nombreips || null,
        modalidad: modalidad || null,
        codigodiagnostico: codigodiagnostico || null,
        diagnostico: diagnostico || null,
        plansos: plansos || null,
        fechaformula: fechaformula || null,
        laboratorio: laboratorio || null,
        eps: eps || null,
        registradopor: registradopor || null
    };

    // Código para insertar en la base de datos
    const sql = `
  INSERT INTO pendientes (
        fecharegistro, identificacion, tipoidentificacion, nombre, medicamento, cantidadpendiente, cantidadentregada, cantidadpendientefinal,
        controlmensual, numerofactura, tipoproducto, cobertura, cantidadprescrita, tipoentrega, sedependiente, estadodispensacion,
        cum, observacion, numeroformula, celular, celular2, direccion, ambito, nitips, nombreips,
        modalidad, codigodiagnostico, diagnostico, plansos, fechaformula, laboratorio, eps, registradopor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const values = [
    data.fecharegistro, data.identificacion, data.tipoidentificacion, data.nombre, data.medicamento, data.cantidadpendiente,0, data.cantidadpendiente, data.controlmensual,
    data.numerofactura, data.tipoproducto, data.cobertura, data.cantidadprescrita, data.tipoentrega, data.sedependiente, data.estadodispensacion,
    data.cum, data.observacion, data.numeroformula, data.celular, data.celular2, data.direccion, data.ambito, data.nitips, data.nombreips,
    data.modalidad, data.codigodiagnostico, data.diagnostico, data.plansos, data.fechaformula, data.laboratorio, data.eps, data.registradopor
];


    req.db.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error al guardar los datos: ', error);
            return res.status(500).json({ message: 'Error al guardar los datos' });
        }
        res.status(201).json({ message: 'Datos guardados correctamente' });
    });
});



// Endpoint para obtener el último número de factura
router.get('/pendientes/ultimoNumeroFactura', (req, res) => {
    const query = 'SELECT MAX(numeroFactura) AS ultimoNumeroFactura FROM pendientes';
    
    req.db.query(query, (error, results) => { // Cambia connection por req.db
        if (error) {
            console.error('Error al obtener el último número de factura:', error);
            return res.status(500).json({ error: 'Error al obtener el último número de factura' });
        }
        
        const ultimoNumeroFactura = results[0] ? results[0].ultimoNumeroFactura : null; // Verifica si results[0] existe
        res.json({ numeroFactura: ultimoNumeroFactura });
    });
});

// Ruta para manejar la inserción de datos pacientes
router.post('/pacientes', (req, res) => {
    const { identificacion, tipoidentificacion, nombre, telefono, eps} = req.body;

    // Verificar campos obligatorios
    if (!tipoidentificacion || !identificacion || !nombre || !eps) {
        return res.status(400).json({ message: 'Los campos identificacion, nombre, tipo de identificacion, telefono y eps son requeridos' });
    }

    // Crear un objeto con los datos, omitiendo los campos no proporcionados
    const data = {
        identificacion,
        tipoidentificacion: tipoidentificacion || null,
        nombre,
        telefono,
        eps
    };
    // Código para insertar en la base de datos
    const sql = 'INSERT INTO pacientes (identificacion, tipoidentificacion, nombre, telefono, eps) VALUES (?, ?, ?, ?, ?)'; 
    const values = [data.identificacion, data.tipoidentificacion, data.nombre, data.telefono, data.eps]; 

    req.db.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error al guardar los datos: ', error);
            return res.status(500).json({ message: 'Error al guardar los datos' });
        }
        res.status(201).json({ message: 'Datos guardados correctamente' });
    });
});


router.post('/entregados', (req, res) => {
    const {numerodelentregado, fecharegistro, diasEntrega, identificacion, tipoidentificacion,
        nombre, celular, eps, municipio, numeroautorizacion, regimen, codigomipres, 
        autorizacionmipres, validacionpgp, modalidad, copago_cuota, valorcopago_cuota, rango, fechaformula,
        numeroformula, codigodiagnostico, diagnostico, sede, nombregenerico,laboratorio, nombrecomercial, 
        formafarmaceutica, fechavencimiento, lote, cantidadprescrita,cantidaddispensada, registradopor, observacion, npendiente
    } = req.body;

    // Verificar campos obligatorios
    if (!fecharegistro || !identificacion || !nombre) {
        return res.status(400).json({ message: 'Los campos fecharegistro, identificacion y nombre son requeridos' });
    }

    // Crear un objeto con los datos, omitiendo los campos no proporcionados
    const data = {
        numerodelentregado : numerodelentregado || null,
        fecharegistro : fecharegistro || null,
        diasEntrega : diasEntrega,
        identificacion : identificacion || null,
        tipoidentificacion : tipoidentificacion || null,
        nombre : nombre || null,
        celular : celular || null,
        eps : eps || null,
        municipio : municipio || "",
        numeroautorizacion : numeroautorizacion || null, 
        regimen : regimen || null,
        codigomipres : codigomipres || null,
        autorizacionmipres: autorizacionmipres || null, 
        validacionpgp: validacionpgp || null,
        modalidad : modalidad || "",
        copago_cuota: copago_cuota || "", 
        valorcopago_cuota: valorcopago_cuota || null,
        rango: rango || '',
        fechaformula: fechaformula,
        numeroformula: numeroformula,
        codigodiagnostico,
        diagnostico,
        sede : sede || null,
        nombregenerico : nombregenerico || null,
        laboratorio : laboratorio || null,
        nombrecomercial : nombrecomercial || "",
        formafarmaceutica : formafarmaceutica || "",
        fechavencimiento : fechavencimiento || null,
        lote : lote || null,
        cantidadprescrita,
        cantidaddispensada : cantidaddispensada || null,
        registradopor: registradopor || null,
        observacion: observacion || "",
        npendiente: npendiente || null
    };

    
    // Código para insertar en la base de datos
    const sql = `
  INSERT INTO entregados (
        numerodelentregado, fecharegistro, diasEntrega, identificacion, tipoidentificacion,
        nombre, celular, eps, municipio, copago_cuota, valorcopago_cuota, rango, fechaformula, numeroformula, codigodiagnostico, diagnostico, numeroautorizacion, regimen,
        codigomipres, autorizacionmipres, validacionpgp, modalidad, sede, nombregenerico, nombrecomercial, laboratorio,
        formafarmaceutica, fechavencimiento, lote, cantidadprescrita,cantidaddispensada,registradopor, observacion, npendiente
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?)
`;

const values = [
    data.numerodelentregado, data.fecharegistro, data.diasEntrega, data.identificacion, data.tipoidentificacion, data.nombre, data.celular, data.eps, data.municipio, data.copago_cuota,
    data.valorcopago_cuota, data.rango, data.fechaformula, data.numeroformula, data.codigodiagnostico, data.diagnostico,data.numeroautorizacion, data.regimen,data.codigomipres,
    data.autorizacionmipres, data.validacionpgp,data.modalidad, data.sede, data.nombregenerico, data.nombrecomercial, data.laboratorio, data.formafarmaceutica, data.fechavencimiento,
    data.lote, data.cantidadprescrita,data.cantidaddispensada, data.registradopor, data.observacion, data.npendiente
];


    req.db.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error al guardar los datos: ', error);
            return res.status(500).json({ message: 'Error al guardar los datos' });
        }
        res.status(201).json({ message: 'Datos guardados correctamente' });
    });
});

router.get('/entregados/ultimoNumeroFactura', (req, res) => {
    const query = 'SELECT MAX(numerodelentregado) AS ultimoNumeroFactura FROM entregados';
    
    req.db.query(query, (error, results) => { // Cambia connection por req.db
        if (error) {
            console.error('Error al obtener el último número de factura:', error);
            return res.status(500).json({ error: 'Error al obtener el último número de factura' });
        }
        
        const ultimoNumeroFactura = results[0] ? results[0].ultimoNumeroFactura : null; // Verifica si results[0] existe
        res.json({ numeroFactura: ultimoNumeroFactura });
    });
});
module.exports = router;