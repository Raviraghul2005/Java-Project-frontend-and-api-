package com.billpilot.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping({"/", "/api"})
    public String home() {
        return "Welcome to the Bill Pilot Subscription Intelligence & Fatigue Audit API (Spring Boot 3.4)";
    }
}
