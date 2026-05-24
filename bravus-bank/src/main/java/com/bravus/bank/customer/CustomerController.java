package com.bravus.bank.customer;

import com.bravus.bank.db.entity.CustomerEntity;
import com.bravus.bank.db.repo.CustomerRepository;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.param.CustomerCreateParams;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerRepository customerRepository;

    public CustomerController(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public record CreateCustomerRequest(
            @NotBlank String name,
            @Email String email,
            @NotBlank @Pattern(regexp = "(PF|PJ)") String type,
            String document,
            String phone
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CreateCustomerResponse(String id, String name, String email, String type) {}

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @Valid CreateCustomerRequest request) throws StripeException {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", request.type());
        if (request.document() != null) metadata.put("document", request.document());

        CustomerCreateParams params = CustomerCreateParams.builder()
                .setName(request.name())
                .setEmail(request.email())
                .putAllMetadata(metadata)
                .build();

        Customer customer = Customer.create(params.toMap());

        CustomerEntity entity = new CustomerEntity();
        entity.setStripeCustomerId(customer.getId());
        entity.setName(customer.getName());
        entity.setEmail(customer.getEmail());
        entity.setType(request.type());
        entity.setDocument(request.document());
        entity.setPhone(request.phone());
        customerRepository.save(entity);

        return ResponseEntity.ok(new CreateCustomerResponse(
                customer.getId(), customer.getName(), customer.getEmail(), request.type()
        ));
    }
}
