import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  actorKey,
  ddb,
  movieKey,
  parseId,
  tableName,
  toActor,
} from "../shared/db";
import { response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const actorId = parseId(event.pathParameters?.actorID);
  if (actorId === undefined) {
    return response(400, { message: "actorID must be a positive integer" });
  }

  const movieParam = event.queryStringParameters?.movie;
  const movieId = parseId(movieParam);
  if (movieParam !== undefined && movieId === undefined) {
    return response(400, { message: "movie must be a positive integer" });
  }
  try {
    const actorResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: actorKey(actorId), SK: actorKey(actorId) },
      })
    );

    if (!actorResult.Item) {
      return response(404, { message: `Actor ${actorId} not found` });
    }
   
    const actor = toActor(actorResult.Item);
    let result: object = actor;

    if (movieId !==undefined){

      // Previously, when a movie that doesn't exist, with an actor that did exist was searched
      // It returned the actor profile. Now it says the movie doesn't exist, without the profile.
      const movieResult = await ddb.send(
        new GetCommand({
        TableName: tableName,
        Key: { PK: movieKey(movieId), SK: movieKey(movieId) },
      })
    );

    if (!movieResult.Item) {
      return response(404, { message: `Movie ${movieId} not found` });
    }



      const roleResult = await ddb.send(
        new GetCommand ({
          TableName: tableName,
          Key: {
            PK: movieKey(movieId),
            SK: actorKey(actorId),
          },
        })
      );
    
      
    result = {
      ...actor, 
      roleDescription: roleResult.Item?.roleDescription,

      };
    }

  
  return response (200, {data: result});


  } catch (err) {
    console.error("DynamoDB error:", err);
    return response(500, { message: "Internal server error" });
  }
};
