import type { APIGatewayProxyEvent } from 'aws-lambda';

// Logs "<cognito username>   <request path>[?query]" to CloudWatch, e.g.
//   doconnor   /actors/4321?movie=1234
export const logRequest = (event: APIGatewayProxyEvent): void => {
  // The authorizer lambda adds relevant info to the event object's context.  )
  // resource used for additional context https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-lambda-authorizer-output.html

  // Retrieves the username of the logged in user from Cognito
  const username = event.requestContext.authorizer?.username;
  const params = Object.entries(event.queryStringParameters ?? {}).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  const query = params.length ? `?${new URLSearchParams(params)}` : '';
  console.log(`${username}   ${event.path}${query}`);
};
