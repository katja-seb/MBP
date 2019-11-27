package org.citopt.connde.repository.projection;

import org.citopt.connde.domain.operatorInstance.OperatorInstance;
import org.springframework.data.rest.core.config.Projection;

@Projection(name = "list", types = {OperatorInstance.class})
public interface OperatorInstanceListProjection {
    String getId();
}
