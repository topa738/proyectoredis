const express = require('express');
const app = express();
const port = 3000;

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'sa2',
  password: '7387',
  port: 5432, // El puerto predeterminado de PostgreSQL es 5432
});

const Redis = require('ioredis');
const redis = new Redis({
  host: 'localhost', // Cambia esto según la configuración de tu servidor Redis
  port: 6379, // Puerto predeterminado de Redis
  // Otros parámetros de autenticación si es necesario
});

app.get('/consultacuentas', (req, res) => {
  // Registra el tiempo antes de ejecutar la consulta

  (async () => {
    const clave = 'consultacuentas'; // Cambia '123' por la clave que deseas verificar
    const existeEnRedis = await verificarExistenciaEnRedis(clave);

    if (existeEnRedis) {
      console.log('La clave existe en Redis');
      const start = performance.now();
      const lista = await obtenerListaDesdeRedis(clave);
      const end = performance.now();

              // Calcula la duración en milisegundos
              const duration = end - start;
             
      res.send(lista);
      
      console.log('Lista en Redis:', lista);
      console.log('el timepo de ejecucion bd redis',duration)
    } else {
      const start = performance.now();
      pool.query(`
        SELECT *
        FROM Cuentas c
        INNER JOIN AsientoCuentas ac ON ac.idcuenta = c.idcuenta
        INNER JOIN Asientos a ON a.idasiento = ac.idasiento
        INNER JOIN tipo_asientocuenta tac ON tac.idtipoasientocuenta = ac.idtipoasientocuenta;
      `, async (error, results) => {
        if (error) {
          console.error('Error al ejecutar la consulta', error);
        } else {
          try {
            // Itera a través de los resultados y guárdalos en Redis
            console.log('Resultados:', results.rows);
                          // Fin del temporizador
              const end = performance.now();

              // Calcula la duración en milisegundos
              const duration = end - start;
              console.log('el timepo de ejecucion bd relacional',duration)
           const promises = results.rows.map(async (result) => {
              const resultStr = JSON.stringify(result);
              await Promise.all([
                redis.rpush(clave, resultStr),
                redis.expire(clave, 120),
              ]);
            });
           
            await Promise.all(promises);
            console.log('Resultados guardados en Redis');
            
            res.send(results.rows);
          } catch (redisError) {
            console.error('Error al guardar resultados en Redis', redisError);
          }
        }
      });
      console.log('La clave no existe en Redis');
    }
  })();
});

async function verificarExistenciaEnRedis(clave) {
  try {
    // Verifica si la clave existe en Redis
    const existe = await redis.exists(clave);
    return existe === 1; // Devuelve true si la clave existe, de lo contrario, false
  } catch (error) {
    console.error('Error al verificar la existencia de la clave en Redis', error);
    return false; // En caso de error, consideramos que la clave no existe
  }
}
async function obtenerListaDesdeRedis(clave) {
    try {
      const lista = await redis.lrange(clave, 0, -1);
      
      //console.log(await redis.llen(clave));
      return lista;
    } catch (error) {
      console.error('Error al obtener la lista desde Redis', error);
      return null;
    }
  }
  


app.get('/', (req, res) => {
  res.send('¡Hola, mundo!');
});

app.listen(port, () => {
  console.log(`El servidor está en marcha en el puerto ${port}`);
});
