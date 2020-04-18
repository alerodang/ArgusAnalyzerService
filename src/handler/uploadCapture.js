'use strict';

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient;
const s3 = new AWS.S3();

const bucket = process.env.APP_BUCKET;
const producersTable = process.env.PRODUCERS_TABLE;

module.exports.handler = async (event) => {
    console.log('DEBUG: parse body');
    const {account: account, producer: producerName, capture, date, secret} = JSON.parse(event.body);

    const getStateParams = {
        Key: {
            "accountId": account
        },
        TableName: producersTable
    };

    const accountData = await dynamoDB.get(getStateParams, function (err, data) {
        if (err) console.log(err, err.stack);
        else console.log('DEBUG dynamo getItem:', data);
    }).promise();

    let state = undefined;
    let expectedSecret;

    accountData['Item'].producers.forEach(producer => {
        if (producer.name === producerName) {
            state = producer.state;
            expectedSecret = producer.secret;
        }
    });

    if (state === undefined) {
        return {
            statusCode: 200,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                success: false,
                message: 'Producer no registered'
            })
        };
    }

    if (!state || state !== 'on' || !expectedSecret && expectedSecret !== secret) {
        return {
            statusCode: 200,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                success: true,
                state: state
            })
        };
    }

    const buffer = Buffer.from(capture.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const day = date.substring(0, 8);
    const minute = date.substring(8, 12);
    const millisecond = date.substring(12);
    const objectKey = 'captures/' + account + '/' + producerName + '/' + day + '/' + minute + '/' + millisecond + '.jpg';

    console.log('DEBUG: upload image');
    await s3.upload({
        Bucket: bucket,
        Key: objectKey,
        Body: buffer
    }).promise();

    return {
        statusCode: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            success: true,
            state: state
        })
    }
};