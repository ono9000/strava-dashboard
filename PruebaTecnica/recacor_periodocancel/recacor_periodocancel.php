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
        return parent::install();
    }

    public function uninstall()
    {
        return parent::uninstall();
    }
}
