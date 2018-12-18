package org.citopt.connde.domain.adapter;

import org.citopt.connde.exception.InsertFailureException;
import org.citopt.connde.exception.NotFoundException;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import javax.persistence.GeneratedValue;
import java.util.ArrayList;
import java.util.List;

/**
 * Document class for Adapters.
 *
 * @author rafaelkperes
 */
@Document
public class Adapter {

    @Id
    @GeneratedValue
    private String id;

    @Indexed(unique = true)
    private String name;

    private String description;

    private Code service;
    private List<Code> routines;

    public Adapter() {
        this.routines = new ArrayList<>();
    }

    public List<Code> getRoutines() {
        return routines;
    }

    public void addRoutine(Code routine) throws InsertFailureException {
        for (Code item : this.routines) {
            if (routine.getName().equals(item.getName())) {
                throw new InsertFailureException("Filename cannot be duplicate!");
            }
        }
        this.routines.add(routine);
    }

    public Code getRoutine(String filename) throws NotFoundException {
        for (Code item : this.routines) {
            if (item.getName().equals(filename)) {
                return item;
            }
        }
        throw new NotFoundException("No such filename.");
    }

    public void deleteRoutine(String filename) throws NotFoundException {
        for (Code item : this.routines) {
            System.out.println(item.getName());
            if (item.getName().equals(filename)) {
                this.routines.remove(item);
                return;
            }
        }
        throw new NotFoundException("No such filename.");
    }

    public boolean hasRoutines() {
        return !this.routines.isEmpty();
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Code getService() {
        return service;
    }

    public void setService(Code service) {
        this.service = service;
    }

}