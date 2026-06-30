export class HttpError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized: Access is denied due to invalid or missing credentials.") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden: You do not have the required permissions to access this resource.") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict: The resource already exists.") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found: The requested resource was not found.") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
