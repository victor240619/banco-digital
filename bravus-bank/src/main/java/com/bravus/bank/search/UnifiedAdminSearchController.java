package com.bravus.bank.search;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/search")
@PreAuthorize("hasRole('ADMIN')")
public class UnifiedAdminSearchController {
    private final UnifiedAdminSearchService searchService;

    public UnifiedAdminSearchController(UnifiedAdminSearchService searchService) {
        this.searchService = searchService;
    }

    @PostMapping("/unified")
    public ResponseEntity<UnifiedSearchDtos.SearchResponse> unified(@Valid @RequestBody SearchRequest request,
                                                                    Authentication auth) {
        UnifiedAdminSearchService.SearchCommand cmd = new UnifiedAdminSearchService.SearchCommand();
        cmd.query = request.query();
        cmd.type = request.type();
        cmd.limit = request.limit();
        return ResponseEntity.ok(searchService.search(cmd, auth.getName()));
    }

    public record SearchRequest(
            @NotBlank String query,
            String type,
            Integer limit
    ) {}
}
