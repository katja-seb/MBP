package org.citopt.connde.service.cep.engine.core.exceptions;

/**
 * Exception that is thrown in case the type of a event that was sent to the CEP engine is not registered there.
 */
public class EventNotRegisteredException extends Exception {
    /**
     * Creats a new exception by passing a message.
     *
     * @param message The exception message
     */
    public EventNotRegisteredException(String message) {
        super(message);
    }
}
