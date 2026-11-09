import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";
import Ajv from "ajv";
import schema from "../shared/role.schema.json";
import { logRequest } from "../shared/request-logger";

const ajv = new Ajv();
const isValidRolePayload = ajv.compile<Role>(schema);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
   logRequest(event);

  const body = parseJsonObject(event);
  if (isResponse(body)) return body;

  if (!isValidRolePayload(body)) {
      return response(400, {
        message: "Incorrect type. Must match the Role schema",
        schema: schema,
      });
    }

  const role: Role = {
    movieId: body.movieId as number,
    actorId: body.actorId as number,
    roleName: body.roleName as string,
    roleDescription: body.roleDescription as string,
  };

  try {
    
    const movieResult = await ddb.send(
          new GetCommand({
            TableName: tableName,
            Key: { PK: movieKey(role.movieId), SK: movieKey(role.movieId)
             },
          })
        );
    
        if (!movieResult.Item) {
          return response(404, { message: `Movie ${role.movieId} not found` });
        }


        const actorResult = await ddb.send(
          new GetCommand({
            TableName: tableName,
            Key: { PK: actorKey(role.actorId), SK: actorKey(role.actorId)
             },
          })
        );
    
        if (!actorResult.Item) {
          return response(404, { message: `Actor ${role.actorId} not found` });
        }

        const roleResult = await ddb.send(
        new GetCommand({
        TableName: tableName,
        Key: { PK: movieKey(role.movieId), SK: actorKey(role.actorId) },
      })
    );

    // 409 conflict error indicates that the request cannot be completed because it conflicts with the current state of the server.
    // It checks if the role already exists, and returns that error message if it does.
    if (roleResult.Item) {
      return response(409, { message: `Role already exists for this movie and actor.` });
    }




    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            //checks that the movie exists
            ConditionCheck: {
              TableName: tableName,
              Key: {
                PK: movieKey(role.movieId),
                SK: movieKey(role.movieId)
              },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            //checks that the actor exists
            ConditionCheck: {
              TableName: tableName,
              Key: {
                PK: actorKey(role.actorId),
                SK: actorKey(role.actorId)
              },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {PK: movieKey(role.movieId), SK: actorKey(role.actorId), ...role,
            },
            ConditionExpression: "attribute_not_exists(PK)"
          },
        },
        ],
      })
    );


    return response(201, { message: "Role added", data: role });
  } catch (err) {
    console.error("DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
    
    });
  }
};
