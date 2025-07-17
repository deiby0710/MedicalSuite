module.exports = {
    apps: [
      {
        name: 'MD-Municipios',
        script: 'server.js', // Cambia 'app.js' por el nombre de tu archivo principal
        node_args: '--max-old-space-size=10240'
        //instances: 'max', // Ejecuta una instancia por cada núcleo de CPU disponible
        //exec_mode: 'cluster', // Modo cluster para manejar múltiples procesos
        // Otras configuraciones (opcional)
      },
    ],
  };