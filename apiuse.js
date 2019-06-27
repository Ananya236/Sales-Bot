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

var inMemoryStorage = new builder.MemoryBotStorage();
var bot = new builder.UniversalBot(connector).set('storage', inMemoryStorage);

var luisAppId = "997af84b-e311-4111-a705-ae8a54f82859";
var luisAuth = "adc737d310c1412faca9c3a9c347ed94";
var endpoint = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/";

let result;

const luisUrl = endpoint + luisAppId + '?subscription-key=' + luisAuth;
var recogniser = new builder.LuisRecognizer(luisUrl)
    .onFilter(function (session, results, callback) {
        if (results.score <= 0.6) {
            //console.log(session);
            result = results;
            callback(null, { score: 0.6, intent: 'None' });
        }
        else {
            callback(null, results);
        }
    })

bot.recognizer(recogniser);

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
            console.log(a);
            resolve(a);
        });
    });
}
//data().then((a) => console.log(a));

function fetchData(session) {
    session.conversationData.steel.forEach((a) => {
        data(a)
            .then(data => {
                var sales = 0, cost = 0, margin = 0, total = 0, max = 0, min = data[0].Price, maxMargin = 0, minMargin = data[0].Price - data[0].Cost;
                session.conversationData.content["Steel"] = data[0].Material;
                session.conversationData.content["ToDate"] = moment(data[0].Time);
                if (session.conversationData.curr && session.conversationData.range.length == 0) {
                    session.conversationData.day.push(data[0].Time);
                }
                if (session.conversationData.day.length > 0 && session.conversationData.range.length == 0) {
                    session.conversationData.day.forEach(dateGiven => {
                        data.forEach(element => {
                            if (dateGiven == element.Time) {
                                total++;
                                if(session.conversationData.day.length==1){
                                    min=element.Price;
                                }
                                if (element.Price > max)
                                    max = element.Price;
                                if (element.Price < min)
                                    min = element.Price;
                                sales = sales + element.Price;
                                cost = cost + element.Cost;
                                margin = margin + (element.Price - element.Cost);
                                // session.conversationData.quer.forEach(query => {
                                //     if (query == "price") {
                                //         sales = sales + element.Price;
                                //         session.conversationData.content["Price"] = Math.round(sales / total);
                                //     }
                                //     else if (query == "cost") {
                                //         cost = cost + element.Cost;
                                //         session.conversationData.content["Cost"] = Math.round(cost / total);
                                //     }
                                //     else {
                                //         margin = margin + (element.Price - element.Cost);
                                //         session.conversationData.content["Margin"] = Math.round(margin / total);
                                //     }
                                // });
                                session.conversationData.content["Date"] = element.Time;
                                session.conversationData.content["Price"] = Math.round(sales / total);
                                session.conversationData.content["Cost"] = Math.round(cost / total);
                                session.conversationData.content["Margin"] = Math.round(margin / total);
                                session.conversationData.content["High"] = max;
                                session.conversationData.content["Low"] = min;
                            }
                        });
                        session.replaceDialog('showInfo');
                    })
                }
                else if (session.conversationData.range.length > 0) {
                    data.forEach(element => {
                        var date = new Date(element.Time)
                        var dateM = moment([date.getFullYear(), date.getMonth(), date.getDate()])
                        total = session.conversationData.end.diff(session.conversationData.start, 'days');
                        if (dateM >= session.conversationData.start && dateM < session.conversationData.end) {
                            if (element.Price > max)
                                max = element.Price;
                            if (element.Price < min)
                                min = element.Price;
                            sales = sales + element.Price;
                            cost = cost + element.Cost;
                            margin = margin + (element.Price - element.Cost);
                            // session.conversationData.quer.forEach(query => {
                            //     if (query == "price") {
                            //         sales = sales + element.Price;
                            //         session.conversationData.content["Price"] = Math.round(sales / total);
                            //     }
                            //     else if (query == "cost") {
                            //         cost = cost + element.Cost;
                            //         session.conversationData.content["Cost"] = Math.round(cost / total);
                            //     }
                            //     else {
                            //         margin = margin + (element.Price - element.Cost);
                            //         session.conversationData.content["Margin"] = Math.round(margin / total);
                            //     }
                            // });
                            session.conversationData.content["FromDate"] = session.conversationData.start;
                            session.conversationData.content["ToDate"] = session.conversationData.end;
                            session.conversationData.content["Price"] = Math.round(sales / total);
                            session.conversationData.content["Cost"] = Math.round(cost / total);
                            session.conversationData.content["Margin"] = Math.round(margin / total);
                            session.conversationData.content["High"] = max;
                            session.conversationData.content["Low"] = min;
                        }
                    });
                    session.replaceDialog('showInfo')
                }
                else {
                    session.conversationData.quer.forEach(query => {
                        if (query == "profit") {
                            data.forEach(element => {
                                margin = element.Price - element.Cost;
                                if (maxMargin < margin) {
                                    console.log(margin);
                                    maxMargin = margin;
                                    session.conversationData.day.push(element.Time);
                                    sales = element.Price;
                                    cost = element.Cost;
                                    max = sales;
                                    min = sales;
                                    session.conversationData.content["Steel"] = element.Material;
                                    session.conversationData.content["Date"] = element.Time;
                                }
                                session.conversationData.content["Price"] = sales;
                                session.conversationData.content["Cost"] = cost;
                                session.conversationData.content["Margin"] = maxMargin;
                                session.conversationData.content["High"] = max;
                                session.conversationData.content["Low"] = min;
                            })
                        }
                        else if(query=="loss"){
                            data.forEach(element => {
                                margin = element.Price - element.Cost;
                                if (minMargin > margin) {
                                    minMargin = margin;
                                    session.conversationData.day.push(element.Time);
                                    sales = element.Price;
                                    cost = element.Cost;
                                    max = sales;
                                    min = sales;
                                    session.conversationData.content["Steel"] = element.Material;
                                    session.conversationData.content["Date"] = element.Time;
                                }
                                session.conversationData.content["Price"] = sales;
                                session.conversationData.content["Cost"] = cost;
                                session.conversationData.content["Margin"] = minMargin;
                                session.conversationData.content["High"] = max;
                                session.conversationData.content["Low"] = min;
                            })
                        }
                        else {
                            data.forEach(element => {
                                total++;
                                if (element.Price > max)
                                    max = element.Price;
                                if (element.Price < min)
                                    min = element.Price;
                                sales = sales + element.Price;
                                cost = cost + element.Cost;
                                margin = margin + (element.Price - element.Cost);
                                session.conversationData.content["FromDate"] = moment(data[total - 1].Time);
                                session.conversationData.content["Price"] = Math.round(sales / total);
                                session.conversationData.content["Cost"] = Math.round(cost / total);
                                session.conversationData.content["Margin"] = Math.round(margin / total);
                                session.conversationData.content["High"] = max;
                                session.conversationData.content["Low"] = min;
                            })
                        }
                    })
                    session.replaceDialog('showInfo')
                }
                console.log(session.conversationData.content);
            })
            .catch(err => console.log(err));
    });
}

function getEntity(intent, session) {
    var days = builder.EntityRecognizer.findAllEntities(intent.entities, 'builtin.datetimeV2.date');
    if (days) {
        days.forEach((a) => {
            session.conversationData.day.push(a.resolution.values[0].value);
        })
    }
    session.conversationData.curr = builder.EntityRecognizer.findEntity(intent.entities, 'current');
    var num = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.number')
    var upto = builder.EntityRecognizer.findEntity(intent.entities, 'upto');
    session.conversationData.range = builder.EntityRecognizer.findAllEntities(intent.entities, 'builtin.datetimeV2.daterange');
    if (upto) {
        if (session.conversationData.range.length == 2) {
            var rangeStart = new Date(session.conversationData.range[0].resolution.values[0].start);
            session.conversationData.start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
            var rangeEnd = new Date(session.conversationData.range[1].resolution.values[0].end);
            session.conversationData.end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
        }
        else if (session.conversationData.range && session.conversationData.day.length > 0) {
            var rangeStart = new Date(session.conversationData.range[0].resolution.values[0].start);
            session.conversationData.start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
            var rangeEnd = new Date(day[0]);
            session.conversationData.end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
        }
        else if (session.conversationData.range && num) {
            var rangeStart = new Date(session.conversationData.range[0].resolution.values[0].start);
            session.conversationData.start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
            var rangeEnd = new Date();
            rangeEnd.setFullYear = rangeStart.getFullYear()
            rangeEnd.setMonth = rangeStart.getMonth()
            rangeEnd.setDate = num
            session.conversationData.end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
        }
    }
    else {
        if (session.conversationData.range.length > 0) {
            var rangeStart = new Date(session.conversationData.range[0].resolution.values[0].start);
            session.conversationData.start = moment([rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()])
            var rangeEnd = new Date(session.conversationData.range[0].resolution.values[0].end);
            session.conversationData.end = moment([rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()])
        }
    }
    if (session.conversationData.day.length == 0 && session.conversationData.range.length == 0 && !session.conversationData.curr) {
        return false;
    }
    else {
        fetchData(session);
    }
}

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
        session.conversationData.quer = [], session.conversationData.steel = [], session.conversationData.day = [];
        var intent = args.intent;
        var queries = builder.EntityRecognizer.findAllEntities(intent.entities, 'query');
        queries.forEach((a) => {
            session.conversationData.quer.push(a.resolution.values[0]);
        });
        var steels = builder.EntityRecognizer.findAllEntities(intent.entities, 'steel');
        if (steels.length > 0) {
            steels.forEach((a) => {
                session.conversationData.steel.push(a.resolution.values[0]);
            })
        }
        else {
            session.conversationData.steel.push("");
        }
        var flag = true;
        flag = getEntity(intent, session);
        if (flag == false) {
            builder.Prompts.choice(session, 'Is there any specific date or range?', 'Yes|No', { listStyle: builder.ListStyle.button });
        }
    },
    function (session, results) {
        if (results.response.entity == "Yes") {
            builder.Prompts.text(session, "please specify the date or range");
        }
        else {
            fetchData(session);
        }
    },
    function (session, results) {
        if (results.response) {
            getEntity(result, session);
        }
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
                    {
                        "type": "Container",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": session.conversationData.content.Steel,
                                "weight": "bolder",
                                "size": "large",
                                //"isSubtle": true
                            }
                        ]
                    },
                    {
                        "type": "Container",
                        "spacing": "none",
                        "items": [
                            {
                                "type": "ColumnSet",
                                "columns": [
                                    {
                                        "type": "Column",
                                        "width": "stretch",
                                        "items": [
                                            {
                                                "type": "TextBlock",
                                                "text": "Margin on an average:",
                                                //"size": "medium",
                                                "spacing": "none",
                                                "isSubtle": true
                                            },
                                            {
                                                "type": "TextBlock",
                                                "text": Math.abs(session.conversationData.content.Margin),
                                                "size": "medium"
                                            }
                                        ]
                                    },
                                    {
                                        "type": "Column",
                                        "width": "auto",
                                        "items": [
                                            {
                                                "type": "FactSet",
                                                "facts": [
                                                    {
                                                        "title": "Market Price",
                                                        "value": session.conversationData.content.Price
                                                    },
                                                    {
                                                        "title": "High",
                                                        "value": session.conversationData.content.High
                                                    },
                                                    {
                                                        "title": "Low",
                                                        "value": session.conversationData.content.Low
                                                    },
                                                    {
                                                        "title": "Cost",
                                                        "value": session.conversationData.content.Cost
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        };
        if (session.conversationData.day.length > 0 && session.conversationData.range.length == 0) {
            card.content.body[0].items.push(
                {
                    "type": "TextBlock",
                    "text": moment(session.conversationData.content.Date).format('LL'),
                    "isSubtle": true
                }
            )
        }
        else {
            card.content.body[0].items.push(
                {
                    "type": "TextBlock",
                    "text": `${(session.conversationData.content.FromDate).format('LL')} to ${(session.conversationData.content.ToDate).format('LL')}`,
                    "isSubtle": true
                }
            )
        }
        if (session.conversationData.content.Margin < 0) {
            card.content.body[1].items[0].columns[0].items.push(
                {
                    "type": "TextBlock",
                    "text": `▼ ${Math.round(Math.abs(session.conversationData.content.Margin) / session.conversationData.content.Cost * 100)}%`,
                    "size": "small",
                    "color": "warning",
                    "spacing": "none"
                }
            )
        }
        else {
            card.content.body[1].items[0].columns[0].items.push(
                {
                    "type": "TextBlock",
                    "text": `▲ ${Math.round(session.conversationData.content.Margin / session.conversationData.content.Cost * 100)}%`,
                    "size": "small",
                    "color": "good",
                    "spacing": "none"
                }
            )
        }
        // for (element in session.conversationData.content) {
        //     var colSet = {
        //         "type": "ColumnSet",
        //         "separator": true,
        //         "columns": [
        //             {
        //                 "type": "Column",
        //                 width: "auto",
        //                 separator: true,
        //                 "items": [
        //                     {
        //                         "type": "TextBlock",
        //                         "text": element,
        //                         "weight": "bolder"
        //                     }
        //                 ]
        //             }
        //         ]
        //     }
        //     if (element == "Margin") {
        //         if (session.conversationData.content.Margin < 0) {
        //             colSet.columns.push({
        //                 "type": "Column",
        //                 width: "auto",
        //                 separator: true,
        //                 "items": [
        //                     {
        //                         "type": "TextBlock",
        //                         "text": `▼ ${Math.abs(session.conversationData.content[element])}`,
        //                         "color": "warning"
        //                     }
        //                 ]
        //             })
        //         }
        //         else {
        //             colSet.columns.push({
        //                 "type": "Column",
        //                 width: "auto",
        //                 separator: true,
        //                 "items": [
        //                     {
        //                         "type": "TextBlock",
        //                         "text": `▲ ${session.conversationData.content[element]}`,
        //                         "color": "good"
        //                     }
        //                 ]
        //             })
        //         }
        //     }
        //     else {
        //         colSet.columns.push({
        //             "type": "Column",
        //             width: "auto",
        //             separator: true,
        //             "items": [
        //                 {
        //                     "type": "TextBlock",
        //                     "text": session.conversationData.content[element],
        //                     "color": "default"
        //                 }
        //             ]
        //         })
        //     }
        //     card.content.body.push(colSet);
        // };
        msg.addAttachment(card);
        session.send(msg);
    }
]);
