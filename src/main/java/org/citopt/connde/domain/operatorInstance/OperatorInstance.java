package org.citopt.connde.domain.operatorInstance;

import javax.persistence.GeneratedValue;

import org.citopt.connde.domain.adapter.Adapter;
import org.citopt.connde.domain.device.Device;
import org.citopt.connde.service.deploy.OperatorInstanceState;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;

/**
 * @author francoaa
 *
 */
public class OperatorInstance {

    @Id
    @GeneratedValue
    private String id;
    
    private String name;
    
    private OperatorInstanceState state;
    
    @DBRef
    private Adapter adapter;
    
    @DBRef
    private Device device;

    public OperatorInstance () {
    	super();
    }
    
	public OperatorInstance(String name, OperatorInstanceState state, Adapter adapter, Device device) {
		this.name = name;
		this.state = state;
		this.adapter = adapter;
		this.device = device;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}
	
	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
	
	public OperatorInstanceState getState() {
		return state;
	}

	public void setState(OperatorInstanceState state) {
		this.state = state;
	}

	public Adapter getAdapter() {
		return adapter;
	}

	public void setAdapter(Adapter adapter) {
		this.adapter = adapter;
	}

	public Device getDevice() {
		return device;
	}

	public void setDevice(Device device) {
		this.device = device;
	}

}
