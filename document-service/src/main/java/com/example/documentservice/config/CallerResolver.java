package com.example.documentservice.config;

import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;

/**
 * Dựng Caller từ header của gateway; thiếu hoặc sai định dạng thì 401. Service này PHẢI chỉ nhận request qua gateway
 * (không publish cổng ra ngoài), vì header không được xác thực ở đây.
 */
public class CallerResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter p) {
        return p.getParameterType() == Caller.class;
    }

    @Override
    public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav, NativeWebRequest req, WebDataBinderFactory f) {
        try {
            return new Caller(Long.parseLong(req.getHeader("X-User-Id")), req.getHeader("X-User-Role").trim(),
                    Long.parseLong(req.getHeader("X-Department-Id")));
        } catch (RuntimeException e) { // thiếu header (null) hoặc id không phải số
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing identity (call through the gateway)");
        }
    }
}
