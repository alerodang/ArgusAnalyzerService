'use strict';

const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition;
const dynamoDB = new AWS.DynamoDB.DocumentClient;
const s3 = new AWS.S3();

const collectionsTable = process.env.COLLECTIONS_TABLE;

module.exports.handler = async (event) => {

    const bucket = event.Records[0].s3.bucket.name;
    const objectKey = event.Records[0].s3.object.key.replace('%40', '@');
    const account = objectKey.split('/')[1];
    const collectionId = account.replace('@', '-');

    const searchFacesByImageParams = {
        CollectionId: collectionId,
        FaceMatchThreshold: 90,
        Image: {
            'S3Object': {
                'Bucket': bucket,
                'Name': objectKey,
            }
        },
        MaxFaces: 1,
    };

    const rekognitionResponse = await rekognition.searchFacesByImage(searchFacesByImageParams, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else console.log('DEBUG rekognition searchFaces:', data); // successful response
    }).promise();

    const faceId = rekognitionResponse.FaceMatches[0].Face.FaceId;

    const getFaceDataParams = {
        Key: {
            "RekognitionFaceId": faceId,
        },
        TableName: collectionsTable
    };

    const faceData = await dynamoDB.get(getFaceDataParams, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else console.log('DEBUG dynamo getItem:', data); // successful response
    }).promise();

    const body = JSON.stringify(faceData);
    const eventKey = objectKey.replace('captures', 'events').replace('.jpg', '.json');
    const putObjectParams = {
        Body: body,
        Bucket: bucket,
        Key: eventKey,
    };

    await s3.putObject(putObjectParams, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else console.log('DEBUG s3 putObject:', data); // successful response
    }).promise();

    return {
        statusCode: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            success: true
        })
    }
};

