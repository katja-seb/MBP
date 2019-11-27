package org.citopt.connde.repository;

import java.util.List;

import org.citopt.connde.domain.operatorInstance.OperatorInstance;
import org.citopt.connde.repository.projection.OperatorInstanceListProjection;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

/**
 * @author francoaa
 *
 */
@RepositoryRestResource(collectionResourceRel = "operator-instances", path = "operator-instances")
public interface OperatorInstanceRepository extends MongoRepository<OperatorInstance, String> {
	
	List<OperatorInstanceListProjection> findAllByDeviceId(@Param("device.id") String deviceId);
}
