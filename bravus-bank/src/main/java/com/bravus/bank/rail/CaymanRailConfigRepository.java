package com.bravus.bank.rail;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CaymanRailConfigRepository extends JpaRepository<CaymanRailConfigEntity, Long> {
}
