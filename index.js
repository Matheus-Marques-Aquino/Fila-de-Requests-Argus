const express = require('express');

//Administra as sessões para consulta no Banco de Dados MongoDB
const session = require('express-session');
const MongoStore = require('connect-mongodb-session')(session);

const dotenv = require('dotenv');

//Adiciona as rotas de importação de lead e loop de requisições para o Argus
const indexRoutes = require('./routes/argus-queue'); 

const app = express();

dotenv.config();

//Impede a finalização da aplicação em caso de erro
process.on('uncaughtException', (err) => { 
    console.error('Unhandled Exception:', err); 
});

//Configura o armazenamento de sessões no MongoDB para não ter memory leak
const store = new MongoStore({ 
    uri: process.env.DB_URL, 
    collection: "Sessions", 
});

store.on("error", function (error) { 
    console.log(error); 
});

app.use(
    session({
        secret: process.env.DB_SECRET_TOKEN,
        saveUninitialized: true,
        resave: false,
        store
    })
);

app.use(express.json());

app.use('/', indexRoutes);

const port = 8080;

app.listen(port, () => { console.log(`Servidor rodando na porta ${port}`); });

//gcloud functions deploy argus-sleep-function --runtime nodejs18 --trigger-http --entry-point app