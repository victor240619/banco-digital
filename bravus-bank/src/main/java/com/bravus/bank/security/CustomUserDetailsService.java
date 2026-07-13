package com.bravus.bank.security;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {
    
    private final UserRepository userRepository;
    
    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String normalizedCpf = username == null ? "" : username.replaceAll("\\D", "");
        UserEntity user = userRepository.findByUsername(username)
                .or(() -> userRepository.findByEmail(username))
                .or(() -> normalizedCpf.length() == 11 ? userRepository.findByCpf(normalizedCpf) : java.util.Optional.empty())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        
        if (!user.getIsActive()) {
            throw new UsernameNotFoundException("User is not active: " + username);
        }
        
        return User.builder()
                .username(user.getUsername())
                .password(user.getPassword())
                .authorities(user.getRoles().stream()
                        .map(role -> new SimpleGrantedAuthority(role.getName()))
                        .collect(Collectors.toList()))
                .build();
    }
}
