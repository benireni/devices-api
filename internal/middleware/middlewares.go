package middleware

import "net/http"

type Middleware func(http.Handler) http.Handler

func StackMiddlewares(middlewares ...Middleware) Middleware {
	if len(middlewares) == 0 {
		return func(next http.Handler) http.Handler { return next }
	}

	if len(middlewares) == 1 {
		return middlewares[0]
	}

	return func(handler http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			middleware := middlewares[i]
			handler = middleware(handler)
		}

		return handler
	}
}
