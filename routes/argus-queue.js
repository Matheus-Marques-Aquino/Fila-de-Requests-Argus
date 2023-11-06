const express = require("express");
const router = express.Router();
const axios = require('axios');
const dotenv = require('dotenv');

const { DateTime } = require('luxon');

const MongoConnection = require('../configs/mongodb');

const mongo = new MongoConnection;

dotenv.config();

router.post('/lead-argus', async (req, res)=>{
    const now = DateTime.now().setZone('America/Sao_Paulo');

    var userId = req.session.userId || false;

    if (!userId){
        req.session.userId = mongo.generateUserId();
        userId = req.session.userId;
    }

    var client = mongo.getClient(userId);

    if (client){
        await mongo.disconnect(userId);
        await mongo.connect(userId);
    }else{
        await mongo.connect(userId);
    }

    const request = {
        userIp: req.ip,
        baseUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body
    };

    if ((now.hour >= 20 && now.minute >= 30) || (now.hour <= 8)){
        try{
            const RequestQueue = await mongo.getCollection(userId, 'RequestQueue');      
            
            await RequestQueue.insertOne({ 
                ...request,
                timestamp: now.toISO(),
                session: userId, 
                sent: false, 
                error: false 
            });            
        }catch(error){
            console.log(error);
        }

        mongo.disconnect(userId);

        req.session.destroy();

        return res.status(200).send('Lead adicionado a fila');
    }

    var response = await argusRequest(
        req.url || '/',
        req.method || 'POST',
        req.headers || {}, 
        req.body || {}
    );

    const payload = {
        request,
        response      
    };

    try{
        const ResponseList = await mongo.getCollection(userId, 'ResponseList');      
            
        await ResponseList.insertOne({ 
            ...payload,
            timestamp: now.toISO(),
            session: userId, 
            sent: true, 
            error: false 
        });
    }catch(error){
        console.log(error);
    }

    mongo.disconnect(userId);

    req.session.destroy();

    res.status(200).json(payload);
});

router.post('/argus-lead-import', async (req, res)=>{
    const now = DateTime.now().setZone('America/Sao_Paulo');

    var userId = req.session.userId || false;

    if (!userId){
        req.session.userId = mongo.generateUserId();
        userId = req.session.userId;
    }

    var client = mongo.getClient(userId);

    if (client){
        await mongo.disconnect(userId);
        await mongo.connect(userId);
    }else{
        await mongo.connect(userId);
    }

    var leadList = [];

    try{
        const RequestQueue = await mongo.getCollection(userId, 'RequestQueue');

        const ResponseList = await mongo.getCollection(userId, 'ResponseList');

        leadList = await RequestQueue.find({ 'sent': false }).toArray();        

        var executeRequest = async (request) => {
            var response = await argusRequest(
                request.url || '/', 
                request.method || 'POST', 
                request.headers || {}, 
                request.body || {}
            );

            var documentId = request._id;

            delete request._id;
        
            var payload = {
                request,
                response      
            };
            
            await ResponseList.insertOne({ 
                ...payload,
                timestamp: now.toISO(),
                session: userId, 
                sent: true, 
                error: false 
            });

            await RequestQueue.deleteOne({ "_id": documentId });
        }

        var waitBetweenRequest = async (ms) => {
            return new Promise((resolve, reject)=>{
                setTimeout(resolve, ms);
            });
        }

        var requestLoop = async () => {
            if (leadList[0]){
                await executeRequest(leadList[0]);

                console.log(leadList[0]);

                leadList.shift();

                await waitBetweenRequest(500);
                await requestLoop();
            }
        }

        await requestLoop();

    }catch(error){
        console.log(error);
    }
    
    mongo.disconnect(userId);

    req.session.destroy();

    return res.status(200).send('Leads importados');
});

async function argusRequest(url, method, headers, data){
    const enabledHeaders = [
        'authorization', 
        'content-type',
        'accept'
    ];

    var requestReaders = {};

    for(let header in headers){
        let value = headers[header];        
        let key = header.toLowerCase();
        
        if (!enabledHeaders.includes(key)){
            continue;
        }

        requestReaders[header] = value;
    }

    const options = {
        baseURL: process.env.ARGUS_ENDPOINT,
        url: '/', //url,
        method,
        headers: { ...requestReaders },
        data
    };

    var response = {};

    try{
        await axios(options)
            .then((res)=>{
                let {
                    baseURL,
                    url,
                    headers,
                    method,
                    data
                } = res;

                response = {
                    baseURL: baseURL || "",
                    url: url || "",
                    headers: headers,
                    method: method,
                    data: data,
                    error: false
                };

                console.log('Resposta:', response);
            })
            .catch((err)=>{               
                console.error('Erro Requisição:', err);

                let {
                    code,
                    config
                } = err;

                if (!config){
                    config = {};
                }

                if (!err.response){
                    err.response = {};
                }

                let {
                    status,
                    statusText
                } = err.response;

                let {
                    baseURL,
                    url,                    
                    headers,
                    method,
                    data
                } = config;

                method = method || "";
                method = method.toString().toUpperCase();                

                try{ 
                    data = data || "{}";
                    data = JSON.parse(data); 
                }catch(e){}                                

                response = {
                    code,
                    status,
                    statusText,
                    baseURL: baseURL || "",
                    url: url || "",
                    headers: headers,
                    method: method,
                    data: data,
                    error: true
                }; 

                console.log('Response:', response);
            });       
    }catch(err){
        console.error(err);
        response = err;
    }

    return response;
}

module.exports = router;