var restify = require('restify');
var builder = require('botbuilder');
var moment = require('moment');

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`${server.name} is listening to ${server.url}`)
});

var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

server.post('/api/messages', connector.listen());

function data(steel) {
    return new Promise(function (resolve, reject) {
        var request = require("request");

        var options =
        {
            method: 'POST',
            url: 'http://eymarketintelapi.eu-gb.mybluemix.net/pricesbymaterial',
            headers:
            {
                'postman-token': '4e66e72b-13b3-82cb-531a-f6e0c8e7d825',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded'
            },
            form:
            {
                query: steel
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                //throw new Error(error);
                reject(error);
            }
            var a = JSON.parse(body)
            //console.log(a);
            resolve(a);
        });
    });
}
//data().then((a) => console.log(a));

var inMemoryStorage = new builder.MemoryBotStorage();
var bot = new builder.UniversalBot(connector).set('storage', inMemoryStorage);

var luisAppId = "997af84b-e311-4111-a705-ae8a54f82859";
var luisAuth = "adc737d310c1412faca9c3a9c347ed94";
var endpoint = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/";

const luisUrl = endpoint + luisAppId + '?subscription-key=' + luisAuth;
var recogniser = new builder.LuisRecognizer(luisUrl);
bot.recognizer(recogniser);

bot.dialog('/', [
    (session) => {
        session.send("Hi..What do you want to know?");
    }
]).triggerAction({
    matches: 'greet'
});

bot.dialog('query', [
    (session, args) => {
        session.conversationData.content = {};
        var quer=[],steel=[],day=[];
        var intent = args.intent;
        var queries = builder.EntityRecognizer.findAllEntities(intent.entities, 'query');
        queries.forEach((a)=>{
            quer.push(a.resolution.values[0]);
        });
        var steels = builder.EntityRecognizer.findAllEntities(intent.entities, 'steel');
        if (steels) { 
            steels.forEach((a)=>{
                steel.push(a.resolution.values[0]);
            })
        }
        var days = builder.EntityRecognizer.findAllEntities(intent.entities, 'builtin.datetimeV2.date');
        if (days) { 
            days.forEach((a)=>{
                day.push(a.resolution.values[0].value);
            })
        }
        var curr = builder.EntityRecognizer.findEntity(intent.entities, 'current');
        var num = builder.EntityRecognizer.findEntity(intent.entities,'builtin.number')
        var upto = builder.EntityRecognizer.findEntity(intent.entities,'upto');
        var range = builder.EntityRecognizer.findAllEntities(intent.entities, 'builtin.datetimeV2.daterange');
        if(upto){
            if (range.length==2) {
                var rangeStart = new Date(range[0].resolution.values[0].start);
                var start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
                var rangeEnd = new Date(range[1].resolution.values[0].end);
                var end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
            }
            else if(range && day.length>0){
                var rangeStart = new Date(range[0].resolution.values[0].start);
                var start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
                var rangeEnd = new Date(day[0]);
                var end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
            }
            else if(range && num){
                var rangeStart = new Date(range[0].resolution.values[0].start);
                var start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
                var rangeEnd = new Date();
                rangeEnd.setFullYear=rangeStart.getFullYear()
                rangeEnd.setMonth=rangeStart.getMonth()
                rangeEnd.setDate=num
                var end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
                console.log(start,end);
            }
        }
        else{
            if(range.length>0){
                var rangeStart = new Date(range[0].resolution.values[0].start);
                var start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
                var rangeEnd = new Date(range[1].resolution.values[0].end);
                var end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
            }
        }
        
        steel.forEach((a)=>{
            data(a)
            .then(data => {
                var sales = 0, cost = 0, margin = 0, total = 0;
                session.conversationData.content["Steel"]=data[0].Material;
                if (curr && range.length==0) {
                    day.push(data[0].Time);
                }
                if(day.length>0 && range.length==0){
                    day.forEach(dateGiven=>{
                        data.forEach(element=>{
                            if (dateGiven == element.Time) {
                                total++;
                                quer.forEach(query=>{
                                    if (query == "price") {
                                        sales = sales + element.Price;
                                        session.conversationData.content["Price"] = Math.round(sales/total);                                        
                                    }
                                    else if (query == "cost") {
                                        cost = cost + element.Cost;
                                        session.conversationData.content["Cost"] = Math.round(cost/total);                                        
                                    }
                                    else {
                                        margin = margin + (element.Price - element.Cost);
                                        session.conversationData.content["Margin"] = Math.round(margin/total);
                                    }
                                });
                                session.conversationData.content["Date"] = element.Time;
                            }
                        });
                        session.replaceDialog('showInfo');
                    })
                }
                else if(range.length>0){
                    data.forEach(element=>{
                        var date = new Date(element.Time)
                        var dateM = moment([date.getFullYear(), date.getMonth(), date.getDate()])
                        total = end.diff(start, 'days');
                        if (dateM >= start && dateM < end) {
                            quer.forEach(query=>{
                                if (query == "price") {
                                    sales = sales + element.Price;
                                    session.conversationData.content["Price"] = Math.round(sales / total);                                    
                                }
                                else if (query == "cost") {
                                    cost = cost + element.Cost;
                                    session.conversationData.content["Cost"] = Math.round(cost / total);                                    
                                }
                                else {
                                    margin = margin + (element.Price - element.Cost);
                                    session.conversationData.content["Margin"] = Math.round(margin / total);
                                }
                            });
                            session.conversationData.content["FromDate"] = start;
                            session.conversationData.content["ToDate"] = end;
                        }
                    });
                    session.replaceDialog('showInfo')
                }
                else{
                    data.forEach(element=>{
                        total++;
                        quer.forEach(query=>{
                            if (query == "price") {
                                sales = sales + element.Price;
                                session.conversationData.content["Price"] = Math.round(sales/total);
                            }
                            else if (query == "cost") {
                                cost = cost + element.Cost;
                                session.conversationData.content["Cost"] = Math.round(cost/total);
                            }
                            else {
                                margin = margin + (element.Price - element.Cost);
                                session.conversationData.content["Margin"] = Math.round(margin/total);
                            }
                        })
                    })
                    session.replaceDialog('showInfo')
                }
                console.log(session.conversationData.content);
            })
            .catch(err => console.log(err));
        })
    }
]).triggerAction({
    matches: 'query'
});

bot.dialog('showInfo', [
    function (session) {
        var msg = new builder.Message(session);
        var card = {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.0",
                "body": [
                    // {
                    //     "type": "Container",
                    //     "items": [
                    //         {
                    //             "type": "TextBlock",
                    //             "text": `The information you wanted is as follows:`,
                    //             "weight": "bolder"
                    //         }
                    //     ]
                    // }
                ]
            }
        };
        for (element in session.conversationData.content) {
            var colSet = {
                "type": "ColumnSet",
                "separator":true,
                "columns": [
                    {
                        "type": "Column",
                        width:"auto",
                        separator:true,
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": element,
                                "weight":"bolder"
                            }
                        ]
                    }
                ]
            }
            if(element=="Margin"){
                if(session.conversationData.content.Margin<0){
                    colSet.columns.push({
                        "type": "Column",
                        width:"auto",
                        separator:true,
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": `▼ ${Math.abs(session.conversationData.content[element])}`,
                                "color":"warning"
                            }
                        ]
                    })
                }
                else{
                    colSet.columns.push({
                        "type": "Column",
                        width:"auto",
                        separator:true,
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": `▲ ${session.conversationData.content[element]}`,
                                "color":"good"
                            }
                        ]
                    })
                }
            }
            else{
                colSet.columns.push({
                    "type": "Column",
                    width:"auto",
                    separator:true,
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": session.conversationData.content[element],
                            "color":"default"
                        }
                    ]
                })
            }
            card.content.body.push(colSet);
        };
        msg.addAttachment(card);
        session.send(msg);
    }
]);
