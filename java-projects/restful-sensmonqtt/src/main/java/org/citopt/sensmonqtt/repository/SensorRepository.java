package org.citopt.sensmonqtt.repository;

import org.citopt.sensmonqtt.domain.component.Sensor;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

/**
 *
 * @author rafaelkperes
 */
@RepositoryRestResource
public interface SensorRepository
        extends MongoRepository<Sensor, String> {
    
    public Sensor findByName(@Param("name") String name);

}
