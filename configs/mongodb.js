const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config();

const database = 'Fila-Argus';

class MongoConnection {
    constructor() {
        this.connections = new Map();
    }

    //Criar uma hash aleatória para utilizar identificar cada nova sessão
    generateUserId(){
        let userId = '';
        
        for (let i = 0; i < 5; i++){ 
            userId += Math.random(0).toString(36).slice(-10); 
        }

        return userId.toUpperCase();
    }

    //Cria uma conaxão ao banco
    async connect(userId) {
        const client = new MongoClient(process.env.DB_URL, {
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
        });

        try {
            await client.connect();

            this.connections.set(userId, client);

            console.log(`Conexão com o banco de dados aberta para o usuário ${userId}!`);
        } catch (error) {
            console.log(`Ocorreu um erro durante a conexão com o banco de dados para o usuário ${userId}!`, error);
        }

        return client;
    }

    //Finaliza uma sessão e desconecta do banco de daos
    async disconnect(userId) {
        const client = this.connections.get(userId);

        if (client) {
            try {
                await client.close();

                this.connections.delete(userId);

                console.log(`Conexão com o banco de dados fechada para o usuário ${userId}!`);
            } catch (error) {                
                console.log(`Ocorreu um erro ao fechar a conexão com o banco de dados para o usuário ${userId}!`, error);
            }
        }
    }

    //Retorna o client da sessão caso ainda esteja conectado ao banco
    getClient(userId) {
        return this.connections.get(userId);
    }

    //Retorna todas as conexões ao banco
    getConnectedUsers() {
        return Array.from(this.connections.keys());
    }

    //Retorna o banco de dados
    async getDatabase(userId) {
        const client = this.getClient(userId);

        if (client) { 
            return client.db(database); 
        }

        return null;
    }

    //Retorna a Collection para realizar consultas ou adicionar documentos
    async getCollection(userId, collectionName) {
        const db = await this.getDatabase(userId, database);

        if (db) {
            const collections = await db.listCollections({ name: collectionName }).toArray();
            
            if (collections.length > 0) { 
                return db.collection(collectionName); 
            }

            const newCollection = await db.createCollection(collectionName, { capped: false });

            return newCollection;
        }

        return null;
    }
}

module.exports = MongoConnection;
