package com.bravus.bank.search;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class UnifiedSearchDtos {
    private UnifiedSearchDtos() {}

    public static class SearchResponse {
        public String query;
        public String queryType;
        public String normalizedQuery;
        public int resultCount;
        public Map<String, Integer> summary = new LinkedHashMap<>();
        public List<String> warnings = new ArrayList<>();
        public List<SearchResult> results = new ArrayList<>();
    }

    public static class SearchResult {
        public String source;
        public String kind;
        public String id;
        public String title;
        public String subtitle;
        public String status;
        public Integer score;
        public Map<String, Object> fields = new LinkedHashMap<>();
    }
}
