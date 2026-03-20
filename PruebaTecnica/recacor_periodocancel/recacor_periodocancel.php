<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class Recacor_Periodocancel extends Module
{
    const STATUS_CANCELACION = 20;
    const STATUS_PREPARACION = 3;

    public function __construct()
    {
        $this->name = 'recacor_periodocancel';
        $this->tab = 'others';
        $this->version = '1.0.0';
        $this->author = 'Recacor';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = ['min' => '1.7.0.0', 'max' => _PS_VERSION_];
        $this->bootstrap = true;

        parent::__construct(); // debe ir ANTES de $this->l()

        $this->displayName = $this->l('Recacor - Periodo de Cancelación');
        $this->description = $this->l('Gestiona el periodo de cancelación de pedidos');
    }

    public function install()
    {
        if (!OrderState::existsInDatabase(self::STATUS_CANCELACION, 'order_state') ||
            !OrderState::existsInDatabase(self::STATUS_PREPARACION, 'order_state')) {
            $this->_errors[] = $this->l(
                'Los estados de pedido necesarios (ID 20 y ID 3) no existen en la base de datos.'
            );
            return false;
        }

        return parent::install()
            && $this->registerHook('actionValidateOrder');
    }

    public function uninstall()
    {
        return parent::uninstall();
    }

    public function hookActionValidateOrder($params)
    {
        /** @var Order $order */
        $order = $params['order'];

        // Guard: evitar doble asignación si el hook se dispara más de una vez
        // PS actualiza $order->current_state en memoria tras setCurrentState(),
        // por lo que esta comprobación funciona correctamente en llamadas repetidas.
        if ((int)$order->current_state !== self::STATUS_CANCELACION) {
            $order->setCurrentState(self::STATUS_CANCELACION);
        }
    }
}
