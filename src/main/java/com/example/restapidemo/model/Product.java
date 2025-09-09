package com.example.restapidemo.model;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Schema(description = "Product Model")
@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Product {
    
    @Schema(description = "Unique identifier of the product", example = "1")
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Schema(description = "Name of the product", example = "iPhone 13", required = true)
    @NotBlank(message = "Product name is required")
    private String name;
    
    @Schema(description = "Description of the product", example = "Latest Apple smartphone with A15 chip", required = true)
    @NotBlank(message = "Description is required")
    private String description;
    
    @Schema(description = "Price of the product", example = "999.99", required = true)
    @Positive(message = "Price must be positive")
    private double price;
}