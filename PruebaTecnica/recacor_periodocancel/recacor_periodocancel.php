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

    public function getContent()
    {
        $token = Tools::encrypt('recacor_periodocancel/cron');
        $cronUrl = $this->context->link->getModuleLink(
            $this->name,
            'cron',
            ['token' => $token],
            true
        );

        return '
        <div class="panel">
            <div class="panel-heading">
                <i class="icon-cogs"></i> ' . $this->l('Configuración del Cron') . '
            </div>
            <div class="panel-body">
                <p>'
                    . $this->l('Configura el módulo') . ' <strong>ps_cronjobs</strong> '
                    . $this->l('con la siguiente URL y frecuencia de 1 minuto:')
                . '</p>
                <div class="well">
                    <code style="word-break:break-all;">' . htmlspecialchars($cronUrl) . '</code>
                </div>
                <p class="text-muted">'
                    . $this->l('Esta URL transiciona automáticamente los pedidos en "Periodo de Cancelación" de más de 10 minutos a "Preparación en curso".')
                . '</p>
                <hr>
                <h4>' . $this->l('Pasos para configurar ps_cronjobs:') . '</h4>
                <ol>
                    <li>' . $this->l('Ir a Admin → Módulos → buscar "Cron tasks manager" → Configurar') . '</li>
                    <li>' . $this->l('Añadir nueva tarea con la URL de arriba') . '</li>
                    <li>' . $this->l('Frecuencia: cada 1 minuto') . '</li>
                    <li>' . $this->l('Guardar') . '</li>
                </ol>
            </div>
        </div>';
    }
}
